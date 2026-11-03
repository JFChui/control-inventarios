# Lecciones aprendidas — Hotel Demo Inventory

Registro operativo del arranque del proyecto (Next.js + Supabase + Vercel + Cursor).  
Para que la IA lo use en contexto: skill `project-lessons`.

## Qué usar para qué

| Pieza | Para |
|-------|------|
| `.cursor/rules/*` | Contexto siempre activo (dominio + stack) |
| `docs/README.md` | Índice: piso / cuentas / sistemas |
| `docs/manual-usuario.md` | Cómo opera el hotel (sin claves) |
| `docs/manual-sistemas.md` | Arquitectura, RLS, deploy, incidentes |
| `docs/cuentas-de-acceso.md` | Correos y cargos (**sin claves**). Claves: `docs/cuentas-de-acceso.local.md` |
| `docs/product-spec.md` | Qué construir (módulos de negocio) |
| `docs/schema-mvp.md` | Modelo de datos MVP |
| `docs/schema-modules.md` | Blancos, linners, uniformes, dotación, maquinaria, recepción |
| `.cursor/skills/hotel-inventory-domain` | Cómo implementar módulos de inventario |
| `.cursor/skills/project-lessons` | Ops: auth, RLS, MCP, deploy, pitfalls |
| Skills globales (Supabase/Vercel) | Cómo usar esas plataformas |
| Context7 MCP | Docs actuales de librerías |
| Supabase MCP | SQL / migraciones remotas |

**No** sustituir esto por un “custom agent” suelto: las rules + docs + skills viajan con el repo.

---

## Identificadores del proyecto

- Repo GitHub: `your-org/control-inventarios`
- Supabase project ref: `YOUR_PROJECT_REF`
- URL API: `https://YOUR_PROJECT_REF.supabase.co` (sin `/rest/v1/` en el cliente JS)
- Vercel team/proyecto: `your-team/control-inventarios`
- Producción: https://your-app.vercel.app

---

## Arranque que funcionó

1. Contexto de producto → `docs/product-spec.md` + rules `product-domain` / `stack`
2. Scaffold Next.js (App Router, `src/`, TS, Tailwind) en la raíz del repo
3. Supabase: `.env.local` + `@supabase/ssr` (browser/server) + `admin` con service role
4. Migración MVP: tablas, trigger de stock, RLS, seed
5. Supabase MCP (`project_ref=...`) para `apply_migration` / `execute_sql`
6. Usuarios Auth (admin + cliente) + roles en `profiles`
7. UI MVP: login, dashboard, inventario, categorías, movimientos, alertas
8. Vercel: token CLI, link, env vars, `vercel deploy --prod`
9. GitHub: push con PAT cuando no hay `gh auth` interactivo

---

## Pitfalls (no repetir)

### 1. RLS recursion en `profiles` → HTTP 500

**Síntoma:** login OK, pero `from('profiles')` falla con 500.

**Causa:** políticas `FOR ALL` que hacen `EXISTS (SELECT … FROM profiles)` reentran en RLS.

**Fix:** helpers `SECURITY DEFINER` + `set search_path = public` que leen `profiles` **fuera** de RLS del caller. Fase 1: `is_active_user()`, `current_app_role()`, `is_admin()`, `is_mrla()`, `has_manage_catalog()`, `has_write_ops()`, etc. Compat: `has_manage_role` / `has_write_role`.  
Migración original: `supabase/migrations/20260816185000_fix_profile_rls_recursion.sql`. Fase 1 reescribe helpers en `20260818220000_phase1_gov_catalog_requests.sql`.

Do not reintroduce `EXISTS (SELECT 1 FROM profiles …)` inside `profiles` policies.

### 2. URL de Supabase

Usar `https://<ref>.supabase.co`, **no** `…/rest/v1/` en `NEXT_PUBLIC_SUPABASE_URL`.

### 3. Stock

Fuente de verdad: `products.quantity_on_hand` actualizado por **trigger** `apply_stock_movement` al insertar en `stock_movements`. No editar stock “a mano” sin movimiento.

El trigger debe ser `SECURITY DEFINER`: si queda `INVOKER`, un `department_user` pasa RLS de INSERT en movimientos pero el UPDATE de `products` falla por RLS del producto. Migración: `20260818220500_phase1_stock_trigger_rls_execution.sql`. Revocar `EXECUTE` del trigger a `anon`/`authenticated`.

### 4. Roles (cargos actuales)

Menú: `src/lib/auth/modules.ts`. UI asigna: `senior_design_manager`, `design_manager`, `hr_manager`, `laundry_supervisor`, `floor_supervisor_a/b/c`, `mrla`.

| Legado (enum, no asignar) | Actual |
|---------------------------|--------|
| `admin` | `senior_design_manager` |
| `human_resources` | `hr_manager` |
| `department_user` | `floor_supervisor_a` (u otro piso) |

- Gerentes de Diseño y Estilo → catálogo, departamentos, movimientos, usuarios, restablecer clave  
- `hr_manager` → uniformes  
- `laundry_supervisor` → blancos, uniformes, maquinaria (la cuenta LAV debe tener este cargo, no un piso)  
- Supervisores de piso / `mrla` → inventario, conteo, alertas, reportes, dotación, linner recepción  
- Inactivo (`is_active = false`) → ni lectura ni escritura  
- Autorización en DB vía `profiles.role` + helpers, **no** vía `user_metadata` editable  
- Módulo Solicitudes retirado; no hay `/solicitudes`

### 5. Secrets

- Nunca commitear `.env.local` (gitignore `.env*` con excepción `!.env.example`)
- `service_role` y tokens (Vercel/GitHub) solo en env local / Vercel dashboard
- Si se pegan en el chat → **rotar** después

### 6. Git en esta máquina

- Commit sin `user.name`/`user.email` global: usar `git -c user.name=… -c user.email=…` (no reescribir git config)
- Push HTTPS sin login interactivo: PAT con scope `repo` (el token mínimo de `gh` a veces pide `read:org`)

### 7. Vercel + GitHub

Conectar Login Connection de GitHub en la cuenta Vercel y dar acceso al repo de la org. Sin eso, `vercel link` crea el proyecto pero no engancha el repo; igual se puede desplegar con CLI.

### 8. create-next-app en repo no vacío

Crear en subcarpeta temporal y mover archivos; no pisar `docs/` / `.cursor/`.

### 9. Fechas UTC en Vercel (octubre 2026)

Los servidores de Vercel están en UTC. `new Date()` después de las 20:00 en Caracas ya es el día siguiente. “Hoy”, ocupación, dotación, mes de estadísticas e impresión deben usar `src/lib/format/datetime.ts` (`America/Caracas`, locale `es-VE`). El mes de `v_monthly_consumption_by_category` se calcula con `occurred_at at time zone 'America/Caracas'`.

### 10. Historial de migraciones MCP

Prod acumuló versiones distintas a los archivos locales. `supabase db push` no es seguro. Tras `apply_migration`, el nombre del archivo local debe llevar **la versión que MCP registró** (`list_migrations`). Reparar `schema_migrations` es solo metadatos (con backup); no reescribe el schema.

### 11. Vistas SECURITY DEFINER

`v_linen_summary` y `v_monthly_consumption_by_category` sin `security_invoker` se saltan RLS (advisor ERROR). Recrearlas `with (security_invoker = true)`.

### 12. Next 16: `proxy.ts` y cookies

`middleware.ts` pasó a `src/proxy.ts` (`export async function proxy`). Al redirigir, copiar cookies con `cookies.set(cookie)` para no perder `maxAge`/`expires` (si no, la sesión muere al cerrar el navegador).

### 13. Contraseñas en git

Las claves reales estuvieron en `docs/cuentas-de-acceso.md`. No se reescribe `main`; se **rotan** (`scripts/rotate-account-passwords.mjs`) y el archivo del repo queda sin claves. La hoja viva es `docs/*.local.md` (gitignore).

---

## Checklist deploy / smoke test

1. Env en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
2. Push a `main` (Vercel produce) o `vercel deploy --prod`
3. `GET /login` → 200
4. `GET /` sin sesión → redirect login
5. Login gerente → dashboard; ve **Departamentos** y **Usuarios**
6. Supervisor de piso no ve Entradas/salidas y sí ve Stock linner recepción; Lavandería ve Blancos y Maquinaria (no el linner de recepción)
7. Horas en Caracas; Enter en conteo vacío no guarda 0
8. Burbuja de alertas solo con productos inicializados
9. `GET /api/health` público

Checklist RLS vigente: `docs/qa/rls-cargos-checklist.md`.

---

## Usuarios de prueba (dev)

Lista viva (correos, cargos y departamentos; **sin claves**): [`docs/cuentas-de-acceso.md`](cuentas-de-acceso.md). Claves locales: `docs/cuentas-de-acceso.local.md`.

Manual de piso (sin claves): [`docs/manual-usuario.md`](manual-usuario.md).  
Manual de IT: [`docs/manual-sistemas.md`](manual-sistemas.md).

Un `department_user` no escribe hasta tener `department_id` y filas en `product_departments`. Rotar claves cuando el hotel deje de usar correos `.local` de arranque. Las cuentas de prueba `cliente@example.local` y `admin@examplegmail.local` se borraron.

---

## Keep-alive de Supabase (plan gratuito)

El proyecto gratuito de Supabase **se pausa por inactividad**. Hay un cron diario de Vercel (`vercel.json` → `GET /api/health`) que hace un `select` mínimo a Postgres para reducir pausas.

Si el cron falla, no hay tráfico o se acaba el cupo del plan Hobby, **el proyecto puede volverse a pausar**. Un plan de pago es la red real. Tras restaurar en el dashboard, hay que esperar a que vuelva el DNS (`<ref>.supabase.co`).

---

## Fases 2–4

Blancos, inventario físico, uniformes, maquinaria, amenidades por camarera y ocupación vs consumo están en `main`, siempre sobre el mismo `products` + `stock_movements`. El catálogo PDF arranca en `sin_conteo` hasta el primer conteo o entrada.

## Recomendaciones 2026 (linners, vueltas, rectificar)

- `ALTER TYPE ... ADD VALUE` va **en su propia migración**. Postgres no deja usar el valor nuevo en la misma transacción. Ejemplo: `room_service_type` y `stock_movement_source = reception_linner` se añadieron antes de las migraciones que los usan.
- Linners son sub-ubicación de `linen_items.available` (`sum(linners) <= available`); no generan kardex. El envío de no-blancos al linner de recepción sí es salida `source_type = reception_linner`.
- `can_access_module` vive en SQL y en `src/lib/auth/modules.ts`; hay que cambiarlos juntos. El módulo `linner_recepcion` es de gerentes y piso, no de lavandería.
- Supervisores de piso leen maquinaria / blancos / uniformes **solo** porque hay políticas SELECT `can_access_module('reportes')`. No darles escritura por esa vía.
- Vueltas: `(available + in_use + in_laundry) / (total_rooms × pieces_per_room)` en `src/lib/linen/turns.ts`. `hotel_settings.total_rooms = 212`.
- Uniformes: el check de balance pasó a `total = available + in_use + unusable`. No reintroducir el check viejo (sin `unusable`).
- Dotación confirmada: trigger `guard_maid_allocation_counts` bloquea INSERT/UPDATE/DELETE directo; solo `revise_maid_allocation`.
