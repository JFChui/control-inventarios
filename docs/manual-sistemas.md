# Manual de sistemas
## Control de inventarios — Hotel Demo

Documento para **Informática / soporte**. El personal de piso usa el [manual de usuario](manual-usuario.md). Correos y cargos: [cuentas de acceso](cuentas-de-acceso.md) (**sin claves**). Claves locales: `docs/cuentas-de-acceso.local.md`.

Fecha: noviembre 2026.

---

## 1. Qué es este sistema

Aplicación web de inventario para Ama de Llaves / Lavandería del Hotel Demo. Un solo stock compartido entre módulos (kardex, blancos y linners, linner de recepción, conteo físico, dotación, uniformes, maquinaria, alertas, reportes). El módulo Solicitudes se retiró.

| Pieza | Tecnología |
|-------|------------|
| App | Next.js (App Router) + TypeScript + Tailwind |
| Datos y login | Supabase (Postgres + Auth + RLS) |
| Hosting | Vercel (producción al hacer push a `main`) |
| Código | GitHub `your-org/control-inventarios` |

**URL de producción:** https://your-app.vercel.app

No hay app de celular aparte: se usa el navegador. El menú ☰ cubre el layout móvil.

---

## 2. Identificadores (para tickets y dashboards)

| Recurso | Valor |
|---------|--------|
| GitHub | `your-org/control-inventarios` |
| Supabase project ref | `YOUR_PROJECT_REF` |
| API Supabase | `https://YOUR_PROJECT_REF.supabase.co` (**sin** `/rest/v1/` en la env del cliente) |
| Dashboard Supabase | https://supabase.com/dashboard/project/YOUR_PROJECT_REF |
| Vercel (equipo/proyecto) | `your-team/control-inventarios` |
| Cron keep-alive | `GET /api/health` todos los días 12:00 UTC (`vercel.json`) |

---

## 3. Mapa mental (cómo encaja)

```
Usuario (navegador)
    → Vercel (Next.js)
        → Server Actions / RSC
            → @supabase/ssr (cookies de sesión)
                → Postgres con RLS
                    → triggers y RPCs SECURITY DEFINER
```

Reglas que no se negocian:

1. La existencia **no se edita a mano** en `products.quantity_on_hand`. Sube o baja al insertar en `stock_movements` (trigger `apply_stock_movement`).
2. Fórmula: `existencia = anterior + entradas − salidas`.
3. No hay salidas a negativo.
4. Un producto con `inventory_initialized_at` nulo está **sin conteo** y **no entra** en `v_products_low_stock`.
5. Autorización en base de datos (RLS + helpers), no solo en la UI.
6. Fechas operativas en `America/Caracas` (`src/lib/format/datetime.ts`).
7. Fallos de lectura de página lanzan al `error.tsx` del segmento `(app)`; también hay `loading.tsx`, `not-found.tsx` y `global-error.tsx`.

Detalle de negocio: [`product-spec.md`](product-spec.md). Tablas: [`schema-mvp.md`](schema-mvp.md), [`schema-modules.md`](schema-modules.md).

---

## 4. Entorno local (desarrollador)

Requisitos: Node 24 (el CI usa 24), npm, acceso a las env.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Abre http://localhost:3000.

Variables en `.env.local` (nunca al git):

| Variable | Dónde se copia |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (solo servidor: crear usuarios, health check) |

Las mismas tres están en Vercel → Project → Settings → Environment Variables (Production).

`NEXT_PUBLIC_*` viaja al navegador. El **service role** no: si se filtra, quien lo tenga bypasea RLS.

---

## 5. Autenticación y perfiles

- Login: `supabase.auth.signInWithPassword` en `src/app/actions/auth.ts`.
- Cada `auth.users` tiene fila en `public.profiles` (`id` = UUID de Auth).
- Campos clave del perfil: `role`, `department_id`, `is_active`, `must_change_password`, `full_name`.
- Proxy (`src/proxy.ts` → `src/lib/supabase/middleware.ts`):
  - sin sesión → `/login`
  - inactivo o sin perfil → cierra sesión y `/login?error=inactive`
  - `must_change_password` → `/cambiar-password`
  - `/api/health` es público (el cron de Vercel no manda cookie)
  - al redirigir, copiar cookies **con opciones** (`cookies.set(cookie)`), no solo name/value

Alta de usuarios **solo desde la app** (gerentes) o Admin API de Auth. No crear filas a mano en `auth.users` del dashboard sin perfil: el flujo soportado es **Usuarios** o script Admin API.

Los correos `@example.local` **no reciben mail**. No hay reset por e-mail. Un gerente restablece la clave en **Usuarios** (nunca la propia). Rotación masiva: `node scripts/rotate-account-passwords.mjs`.

Roles (`app_role`) que asigna la UI:

| Valor DB | Quién | Alcance (menú) |
|----------|-------|----------------|
| `senior_design_manager` / `design_manager` | Gerentes de Diseño y Estilo | Todo, incluido usuarios |
| `hr_manager` | Capital Humano | Dashboard y uniformes |
| `laundry_supervisor` | Lavandería | Dashboard, blancos, uniformes, maquinaria |
| `floor_supervisor_a/b/c` | Piso | Inventario, conteo, alertas, reportes, dotación, linner recepción |
| `mrla` | MRLA | Igual que piso |

Legado en el enum (no asignar): `admin`, `human_resources`, `department_user`.

Permisos de UI: `src/lib/auth/modules.ts` (`canAccessModule`) + `roles.ts`. Deben coincidir con `can_access_module` / RLS; si la UI deja pasar y SQL niega, el usuario ve error. No relajar RLS para “que funcione”. Server Actions usan `requireModuleAction` (devuelve `{ ok, error }`, no lanza).

---

## 6. Departamentos y catálogo en producción

Departamentos activos:

| Código | Nombre | Productos habilitados (oct 2026) |
|--------|--------|----------------------------------|
| AMA | Ama de Llaves | 0 (el catálogo PDF se partió por EST/LEN/LAV/SUM) |
| EST | Estilo | 45 |
| LEN | Lencería | 36 |
| LAV | Lavandería | 46 |
| SUM | Suministro huésped | 100 |
| MTO | Mantenimiento | 0 |

Categorías con productos activos: Amenidades 54, Blancos 36, Insumos 99, Químicos 38. Equipos 0. Total **227 activos**, todos `inventory_initialized_at` nulo hasta el primer conteo o movimiento.

Habilitación: tabla `product_departments`. Sin fila, un supervisor de piso no opera ese producto en flujos de departamento. Los movimientos **manuales** de kardex son solo de gerentes.

Códigos del PDF se conservan (`STY-0001`, etc.). No “corregirlos” en masa.

---

## 7. Stock, alertas y conteo físico

### Trigger

`apply_stock_movement` (SECURITY DEFINER) actualiza `products.quantity_on_hand` y, si `inventory_initialized_at` es null, lo setea a `now()`.

Si el trigger deja de ser DEFINER, un insert autorizado de movimiento **falla el UPDATE** del producto (RLS). Migración de referencia: `20260818220500_phase1_stock_trigger_rls_execution.sql`. Guards posteriores bloquean `UPDATE` directo de `quantity_on_hand` por `authenticated`/`anon`.

### Clasificación (`classifyStock` y vistas SQL)

| Estado | Regla |
|--------|--------|
| `sin_conteo` | `inventory_initialized_at` is null |
| `agotado` | inicializado y qty ≤ 0 |
| `bajo` | min_stock > 0 y qty ≤ min_stock |
| `proximo` | min_stock > 0 y qty ≤ min_stock × 1.25 |
| `normal` | resto; **o** min_stock ≤ 0 con qty > 0 |

`v_products_low_stock` **excluye** `sin_conteo`. Dashboard y burbuja leen esa vista.

Migración: `supabase/migrations/20261003140000_operational_hardening.sql`.

### Inventario físico

1. UI crea `physical_counts` (draft) + líneas con `system_qty` actual.
2. El conteo se guarda al perder el foco (`updateCountedQtyAction`). Un campo **vacío no se envía** (ni se interpreta como 0).
3. Cerrar llama RPC `post_physical_count`:
   - líneas sin `counted_qty` se omiten
   - `system_qty = 0` → movimiento `in`/`out` con motivo `Apertura inventario físico`
   - si no, ajuste de inventario físico
   - `linen_items`: en apertura, todo a `available` y ceros en uso/lavandería/dañado, de modo que sume `quantity_on_hand`

Publican el conteo los cargos con módulo `inventario_fisico` (gerentes y supervisores de piso). Zona horaria operativa: `America/Caracas`.

Origen de movimientos (`source_type`): `manual` | `request` | `maid_allocation` | `physical_count` | `linen` | `reception_linner`.

Excepción documentada: surtir/devolver blancos entre lavandería y linners **no** escribe kardex (sub-ubicación de `linen_items.available`). Enviar un producto **no blanco** al linner de recepción **sí** es una salida `reception_linner`.

---

## 8. RLS — lo que no hay que romper

Políticas que consultan `profiles` **desde** políticas de `profiles` provocan recursión y **HTTP 500** al leer el perfil (login “ok” pero la app muere).

Usar helpers SECURITY DEFINER con `search_path = public`:

`is_active_user`, `current_app_role`, `current_department_id`, `is_admin`, `is_mrla`, `is_hr`, `is_department_user`, `has_manage_catalog`, `has_write_ops`, `has_hr_scope`, `product_enabled_for_dept`.

Migración del fix: `20260816185000_fix_profile_rls_recursion.sql`. Fase 1 reescribe helpers: `20260818220000_phase1_gov_catalog_requests.sql`.

Checklist vigente: [`qa/rls-cargos-checklist.md`](qa/rls-cargos-checklist.md). Script: `supabase/tests/cargo_rls.sql`. Histórico de fase 1: `qa/phase1-rls-checklist.md`.

Vistas de resumen (`v_linen_summary`, `v_monthly_consumption_by_category`) con `security_invoker = true`. Triggers sin `EXECUTE` para `anon`.

Usuarios `is_active = false`: 0 filas de negocio. También lo bloquea `src/proxy.ts`.

---

## 9. RPCs de negocio (no sustituir por updates sueltos)

| Función | Uso |
|---------|-----|
| `transition_linen(...)` | Ciclo de blancos; baja → salida de kardex |
| `post_physical_count(uuid)` | Cierra conteo |
| `assign_uniform(sku_id, worker_id, qty, notes)` / `return_uniform` | Uniformes atómicos; el trabajador debe existir y estar activo |
| `confirm_maid_allocation(uuid)` | Dotación → salidas |
| `revise_maid_allocation(uuid, jsonb)` | Rectifica conteos y posta el delta en kardex |
| `stock_linner` / `return_from_linner` / `set_linner_par` | Ubicación de blancos en linners |
| `stock_reception_linner` / `consume_reception_linner` | Envío y consumo del linner de recepción |
| `mark_uniform_unusable(...)` | Pasa prendas a no utilizable |
| `set_reception_linner_limits` | Mínimo y máximo del linner de recepción |
| `set_linen_pieces_per_room` | Piezas por habitación (vueltas) |

Invariante de linners: `sum(linen_location_stock.quantity) <= linen_items.available`. Uniformes: `total = available + in_use + unusable`.

Legado (módulo retirado, no llamar desde la app): `create_supply_request`, `deliver_supply_request`.

Guards (octubre 2026): `quantity_on_hand` / estados de conteo y dotación / blancos y uniformes no se editan por API autenticada; solo RPCs y triggers.

Padrón: tabla `uniform_workers` (semilla de ejemplo). `staff_department` es texto del organigrama del hotel; **no** se mezcla con `departments` (EST/LEN/LAV/SUM). Escritura RR.HH. / gerentes / lavandería según menú. Recargar listado: `python scripts/build-uniform-workers.py` y aplicar la migración generada. Las prendas siguen en `uniform_skus` (talla y cantidad).

---

## 10. Rutas de la aplicación

| Ruta | Notas |
|------|--------|
| `/login` | Público |
| `/cambiar-password` | Sesión + must_change_password |
| `/` | Dashboard |
| `/inventario` | Filtros URL: `q`, `category`, `department`, `status`, `activos=1` (default) |
| `/inventario/minimos` | Bulk mínimo/unidad; gerentes |
| `/inventario/nuevo`, `/inventario/[id]`, `/inventario/[id]/editar` | Catálogo / kardex |
| `/movimientos` | Kardex global + formulario (gerentes) |
| `/alertas` | `v_products_low_stock` |
| `/blancos` `/blancos/linners` | Ciclo de blancos y matriz par / real por linner |
| `/inventario/linner-recepcion` | Stock, mín/máx y consumo del linner de recepción |
| `/dotacion` `/inventario-fisico` `/uniformes` `/maquinaria` `/reportes` `/estadisticas` | Módulos (el menú filtra por cargo) |
| `/categorias` `/departamentos` | gerentes |
| `/usuarios` | gerentes; restablecer clave de **otra** cuenta |
| `/api/health` | Público; `select` mínimo a `departments` |

---

## 11. Deploy

Flujo normal de este repo: **commit → push a `main` → Vercel produce solo**. GitHub Actions (`.github/workflows/ci.yml`) corre `npm test`, `lint` y `build` (env placeholder; no usa secretos reales).

No force-push a `main`. No commitear `.env.local`.

Si el push no dispara deploy: Vercel CLI, skill `deploy-to-vercel`, o dashboard del proyecto.

Smoke mínimo tras un deploy:

1. `GET /login` → 200
2. `GET /` sin cookie → redirect login
3. `GET /api/health` → `{ "ok": true }`
4. Login gerente → Dashboard; ve Usuarios / Departamentos
5. Lavandería ve Blancos y Maquinaria; piso no ve Entradas/salidas y sí ve Stock linner recepción
6. Horas en Caracas; Enter en conteo vacío no guarda
7. Inventario: buscar y filtrar. No cerrar conteos de prueba.

---

## 12. Migraciones

Archivos en `supabase/migrations/` (orden por timestamp). No “arreglar prod” en el SQL Editor sin dejar el archivo versionado.

`ALTER TYPE ... ADD VALUE` **va solo** en su migración. Postgres no deja usar el valor nuevo en la misma transacción (ejemplo: `room_service_type` inspected/clean/dirty/out_of_order y `stock_movement_source` reception_linner).

Preferido: MCP `apply_migration`. El nombre del archivo local debe usar la **versión que MCP registró** (`list_migrations`). `npx supabase db push` no es el flujo de este proyecto: el catálogo y el padrón se cargaron fuera de ese historial; si `schema_migrations` se desalinea, reparar solo metadatos (con backup).

Tras migrar vistas (`v_products_low_stock`, etc.) el cliente JS a veces cachea el schema: si una columna nueva “no existe”, recargar el schema en el dashboard o esperar un momento.

---

## 13. Keep-alive (plan gratuito de Supabase)

El proyecto **Hobby se pausa por inactividad**. Mitigación:

- Cron Vercel `0 12 * * *` → `GET https://your-app.vercel.app/api/health`
- El route usa `createAdminClient()` (service role) y hace `select id from departments limit 1`

Si el cron falla, no hay tráfico, o se acaba el cupo, **se vuelve a pausar**. La red real es un plan de pago. Tras Restore en Supabase, esperar DNS de `*.supabase.co`.

Síntoma para el hotel: login infinito o error de red. Acción: dashboard Supabase → Restore, esperar 1–2 minutos, probar `/api/health`.

---

## 14. Incidentes frecuentes

| Síntoma | Causa probable | Qué hacer |
|---------|----------------|-----------|
| Login ok, páginas 500, perfil vacío | RLS recursion en `profiles` | No reintroducir `EXISTS (select … profiles)` en policies de profiles. Ver lecciones. |
| Departamento no puede hacer salida | Producto no está en `product_departments` o `department_id` null | Editar producto; asignar depto al usuario |
| 227 agotados / 227 alertas | Vista vieja sin `sin_conteo` | Confirmar migración `20261003140000`; la vista debe excluir no inicializados |
| Insert de movimiento truena al actualizar stock | Trigger no DEFINER | Restaurar `apply_stock_movement` SECURITY DEFINER |
| URL de Supabase rara | Env con `/rest/v1/` pegado | Quitar el sufijo |
| CI verde y prod rota | Env de Vercel incompleta | Revisar las tres variables en Production |
| Usuario `.local` no recibe mail | Esperado | Reset manual por admin |

Logs: Vercel → Deployments → Functions; Supabase → Logs. MCP `query_logs` / `get_advisors` si se investiga desde Cursor.

---

## 15. Estructura del código (dónde tocar)

| Carpeta | Contenido |
|---------|-----------|
| `src/app/(app)/` | Páginas autenticadas |
| `src/app/actions/` | Server Actions (catálogo, movimientos, usuarios, físico…) |
| `src/app/api/health/` | Keep-alive |
| `src/components/` | Formularios cliente |
| `src/proxy.ts` | Gate de sesión (Next 16) |
| `src/lib/auth/` | Cargos, sesión (`cache()`), redirects |
| `src/lib/actions/` | Guard, parseo, errores en español |
| `src/lib/format/` | Fechas Caracas y etiquetas |
| `src/lib/stock/` | `classifyStock` |
| `src/lib/supabase/` | Clientes browser / server / admin |
| `supabase/migrations/` | SQL versionado |
| `tests/` | Unitarios (Vitest) |
| `docs/` | Esta documentación |
| `.cursor/rules` y `.cursor/skills` | Contexto para el agente / equipo |

UI en español; tablas e IDs en inglés.

---

## 16. Pruebas

```bash
npm test
npm run lint
npm run build
```

Tests de dominio: `tests/stock-status.test.ts`, `tests/catalog.test.ts`, `tests/inventory-filters.test.ts`, `tests/auth-redirect.test.ts`, `tests/linen-turns.test.ts`, `tests/uniform-workers.test.ts`, `tests/roles.test.ts`, `tests/phase-closure.test.ts`, etc.

RLS por cargo: `supabase/tests/cargo_rls.sql` (ROLLBACK). No hay E2E en CI. El smoke de producción se hace a mano (o con el navegador del agente) sobre la URL de Vercel.

---

## 17. Seguridad (mínimo operativo)

- No subir service role, PAT ni `.env.local`.
- Las claves de usuarios **no van en git**. Rotar con `scripts/rotate-account-passwords.mjs`; hoja local gitignored.
- Headers: `poweredByHeader: false`, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy (sin CSP).
- Service role solo en servidor (`createAdminClient`).
- Realtime está en `products` para la burbuja de alertas; no abre escritura.

---

## 18. Documentos hermanos y skills

Índice: [`docs/README.md`](README.md).

Para quien desarrolla con Cursor: rules `stack.mdc` + `product-domain.mdc` + `ship-on-change.mdc`; skills `hotel-inventory-domain` y `project-lessons`. Dudas de API de librerías: Context7 MCP. SQL remoto: Supabase MCP.

Lecciones (pitfalls): [`lessons-learned.md`](lessons-learned.md).
