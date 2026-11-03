# Schema módulos (fases 0–4 + recomendaciones 2026)

Migración base: `supabase/migrations/20260816193000_modules_phase0_to_4.sql` (aplicada por partes en Cloud). Padrón: `supabase/migrations/20261010180000_uniform_workers.sql`.

Recomendaciones 2026 (orden: un `ALTER TYPE ... ADD VALUE` por archivo, luego el resto):

| Migración | Qué añade |
|-----------|-----------|
| `20261023022659_room_service_type_housekeeping_status.sql` | Enum `room_service_type`: `inspected`, `clean`, `dirty`, `out_of_order` |
| `20261023022744_revise_maid_allocation.sql` | `revised_at`, `revision_count`; RPC `revise_maid_allocation` |
| `20261023022934_machines_kind_room_equipment.sql` | Enum `machine_kind`; `machines.kind` |
| `20261023023103_linen_linners_turns.sql` | `storage_locations`, `linen_location_stock`, `pieces_per_room`, `total_rooms = 212` |
| `20261023023341_uniform_buckets_unusable.sql` | `employment_type`, `uniform_skus.unusable`, RPC `mark_uniform_unusable` |
| `20261023023554_stock_movement_source_reception_linner.sql` | Enum `stock_movement_source`: `reception_linner` |
| `20261023023624_reception_linner_module.sql` | `can_access_module('linner_recepcion')`, `reception_linner_stock` |
| `20261023023815_reportes_select_policies.sql` | SELECT de reportes sobre maquinaria, blancos y uniformes |

## Kardex

- `stock_movements.source_type`: `manual` | `request` | `maid_allocation` | `physical_count` | `linen` | `reception_linner`
- `stock_movements.source_id`: uuid del documento origen

No generan kardex: surtir/devolver blancos entre lavandería y linners (sub-ubicación de `available`).

## Tablas

| Tabla | Módulo |
|-------|--------|
| `supply_requests` + `supply_request_lines` | Solicitudes (**módulo retirado**; se conservan tablas e historial) |
| `linen_items` | Blancos (`available`, `in_use`, `in_laundry`, `damaged`, `pieces_per_room`) |
| `storage_locations` | Catálogo de linners (`code`, `kind` = `floor_linner` \| `reception_linner`) |
| `linen_location_stock` | Par (`par_qty`) y existencia (`quantity`) por blanco × linner |
| `reception_linner_stock` | Mín/máx y existencia de **no-blancos** en el linner de recepción |
| `physical_counts` + `physical_count_lines` | Inventario físico |
| `uniform_skus` + `uniform_assignments` + `uniform_workers` | Uniformes (prendas, historial y padrón) |
| `uniform_sku_adjustments` | Ajustes de prendas (`delta_unusable`) |
| `room_supply_params` + `maid_allocations` + `maid_allocation_rooms` | Dotación |
| `maid_allocation_counts` | Conteos por ítem; inmutables si la dotación está `confirmed` (salvo RPC) |
| `machines` + `machine_tickets` + `machine_ticket_events` | Maquinaria y equipos (`machines.kind`) |
| `hotel_settings` | `total_rooms` (212) y parámetros de hotel |
| `daily_occupancy` | Ocupación diaria (dirty / clean) |
| `monthly_occupancy` | Ocupación mensual (resumen) |

### Seed de linners

`L06`–`L26` sin `L13` (20 linners de piso) y `REC` «Linner de Recepción».

### Invariantes

- Blancos: `sum(linen_location_stock.quantity) <= linen_items.available` (`assert_linen_locations_fit`). Almacén de lavandería = `available − sum(linners)`.
- Uniformes: `uniform_skus.total = available + in_use + unusable`.
- Recepción: `reception_linner_stock.max_qty >= min_qty`.

## Uniformes (padrón)

- `uniform_workers`: `uniform_code` único, `last_name`, `first_name`, `staff_department` (texto del hotel, sin FK), `position`, `employment_type` (`fijo` \| `eventual`, default `fijo`), `is_active`. RLS: select `is_active_user()`, escritura `has_hr_scope()`.
- `uniform_assignments.worker_id` → `uniform_workers` (`on delete restrict`); `worker_name` es copia `CODIGO — APELLIDOS NOMBRES`.
- Grupos de UI: Fijos / Eventuales = asignaciones abiertas según `employment_type`; RR.HH. = `available`; No utilizables = `unusable`.
- Regenerar seed desde Excel: `python scripts/build-uniform-workers.py`.

## Dotación

- `room_service_type`: `ocupacion`, `salida`, `limpieza`, `inspected`, `clean`, `dirty`, `out_of_order`.
- `maid_allocations.revised_at` / `revision_count` tras cada `revise_maid_allocation`.
- Conteos de una confirmada solo cambian vía esa RPC (trigger `guard_maid_allocation_counts`).

## Maquinaria

- `machine_kind`: `laundry_machine` (default) | `room_equipment`.
- Tickets e historial iguales para ambos.

## RPCs (SECURITY DEFINER)

- `deliver_supply_request(uuid)` — legado
- `transition_linen(uuid, from, to, qty, location_id?)` — baja a `written_off` genera salida de stock; `available → in_use` desde un linner descuenta de ese linner
- `stock_linner` / `return_from_linner` / `set_linner_par` / `set_linen_pieces_per_room`
- `revise_maid_allocation(uuid, jsonb)` — solo `confirmed`; posta delta `out`/`in` con motivo «Rectificación dotación …»
- `mark_uniform_unusable(sku_id, qty, from, reason, assignment_id?)`
- `stock_reception_linner` / `consume_reception_linner` / `set_reception_linner_limits`
- `post_physical_count(uuid)`
- `assign_uniform(sku_id, worker_id, qty, notes)` / `return_uniform`
- `confirm_maid_allocation(uuid)`

## RLS de lectura para reportes

Quien tiene módulo `reportes` (supervisores de piso / MRLA) puede **SELECT** `machines`, `machine_tickets`, `linen_items`, `linen_location_stock`, `uniform_skus`, `uniform_assignments`, `uniform_workers`. Escritura sigue en los módulos de operación.

`can_access_module` (SQL) y `src/lib/auth/modules.ts` deben coincidir. Módulo `linner_recepcion`: gerentes y piso; **no** lavandería.

## UI rutas

`/inventario/[id]`, `/inventario/linner-recepcion`, `/blancos`, `/blancos/linners`, `/inventario-fisico`, `/reportes`, `/uniformes`, `/dotacion`, `/maquinaria`, `/estadisticas`, `/usuarios` (sin `/solicitudes`)
