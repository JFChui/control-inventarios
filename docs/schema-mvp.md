# Schema MVP — Inventario core

Migración original: `supabase/migrations/20260816172804_mvp_inventory_core.sql`  
Fase 1: `supabase/migrations/20260818220000_phase1_gov_catalog_requests.sql` (+ `20260818220500_phase1_stock_trigger_rls_execution.sql`, `20260818223000_phase1_task2_review_fixes.sql`)  
QA RLS vigente: `docs/qa/rls-cargos-checklist.md` (`supabase/tests/cargo_rls.sql`). El checklist de fase 1 es histórico.

## Tablas

| Tabla | Rol |
|-------|-----|
| `departments` | Departamentos (`code`, `name`, `is_active`) |
| `profiles` | Perfil ligado a `auth.users`: `role`, `department_id`, `is_active`, `must_change_password` |
| `product_categories` | Amenidades, Blancos, Químicos, Insumos |
| `products` | Catálogo + `quantity_on_hand` + `min_stock` + `inventory_initialized_at` (Realtime) |
| `product_departments` | PK `(product_id, department_id)` — productos habilitados por departamento |
| `stock_movements` | Kardex (`in` / `out`); append-only vía RLS. `source_type` se amplió en módulos (`reception_linner`, etc.): ver [`schema-modules.md`](schema-modules.md) |
| `supply_requests` + `supply_request_lines` | Módulo **retirado** de la UI; tablas e historial `source_type = request` se conservan |

## Roles (`app_role`)

Cargos que asigna la UI:

`senior_design_manager` | `design_manager` | `hr_manager` | `laundry_supervisor` | `floor_supervisor_a/b/c` | `mrla`

Valores legado (siguen en el enum, no se asignan): `admin` | `human_resources` | `department_user`.

Helpers de alcance: `has_manage_catalog()` / `has_write_ops()` cubren gerentes de Diseño y Estilo (`senior_design_manager`, `design_manager`) y el legado `admin`. `has_hr_scope()` cubre `hr_manager` y `human_resources`. El menú por cargo está en `src/lib/auth/modules.ts` (`can_access_module` en SQL).

Mapeo al migrar: `admin` → `senior_design_manager`; `human_resources` → `hr_manager`; `department_user` → `floor_supervisor_a`. Default histórico: `department_user`.

## Vistas

- `v_products_low_stock` — productos **inicializados** en alerta (`agotado` o `bajo`); excluye `sin_conteo`  
- `v_products_stock_status` — todos activos con `stock_status` (`sin_conteo` \| `normal` \| `proximo` \| `bajo` \| `agotado`)

Umbral: `sin_conteo` si `inventory_initialized_at` es nulo; `agotado` si qty ≤ 0; si `min_stock` ≤ 0 no hay bajo/próximo (solo `agotado` / `normal`); `bajo` si qty ≤ `min_stock`; `proximo` si qty ≤ `min_stock * 1.25`; si no `normal`.

## Helpers RLS (SECURITY DEFINER, `search_path = public`)

`is_active_user()`, `current_app_role()`, `current_department_id()`, `is_admin()`, `is_mrla()`, `is_hr()`, `is_department_user()`, `has_manage_catalog()`, `has_write_ops()`, `has_hr_scope()`, `can_access_module(text)`, `product_enabled_for_dept(uuid, uuid)`.

Compat: `has_manage_role()` → `has_manage_catalog()`; `has_write_role()` → activo + `has_write_ops()`.

**No** usar `EXISTS (SELECT 1 FROM profiles …)` dentro de policies de `profiles` (recursión → HTTP 500).

## RPCs de solicitudes

- `create_supply_request(department_id, notes, lines jsonb)` — atómica; `department_user` solo su depto y productos habilitados  
- `deliver_supply_request(uuid)` — exige `status = 'approved'`; inserta salidas `source_type = request`; segunda llamada no duplica stock

## Reglas

- Existencia actualizada por **trigger** `apply_stock_movement` al insertar movimiento. El trigger es `SECURITY DEFINER` para que un `department_user` autorizado pueda actualizar `quantity_on_hand` (la policy de INSERT ya autorizó la operación). No ejecutar el trigger desde la API (`REVOKE` a authenticated).
- Salida con stock insuficiente → error  
- RLS activo; catálogo y movimientos manuales: gerentes (`has_manage_catalog` / `has_write_ops`); usuarios inactivos: 0 filas. Escrituras de `quantity_on_hand` por API autenticada están bloqueadas (solo kardex / RPCs).
- Realtime: tabla `products` en `supabase_realtime` (burbuja de alertas)

## Cómo aplicar en Supabase Cloud

### Opción A — SQL Editor (rápida)

1. Abre [SQL Editor](https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql/new)  
2. Pega el contenido del archivo de migración  
3. Run  

### Opción B — CLI

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Preferido en este proyecto: MCP `apply_migration` con el SQL versionado.

## Tras aplicar

1. Crea un usuario en **Authentication → Users** (o desde `/usuarios` como admin)  
2. Promuévelo a gerente:

```sql
update public.profiles
set role = 'senior_design_manager'
where id = '<user-uuid>';
```

## Seed incluido (MVP)

Departamentos, 4 categorías, 7 productos y entradas iniciales de kardex (detergente y guantes quedan en bajo stock a propósito). `product_departments` arranca vacío: hay que habilitar productos por departamento para que `department_user` opere.
