---
name: hotel-inventory-domain
description: >-
  Implements Hotel Demo inventory modules (kardex, blancos, linners,
  linner de recepción, inventario físico, alertas, uniformes, dotación por
  camarera, maquinaria y equipos, ocupación vs consumo). Use when building or
  changing domain features, schema, RLS, or business flows for this hotel
  inventory system.
---

# Hotel Inventory Domain

## Before coding

1. Read `.cursor/rules/product-domain.mdc` (already always-on).
2. Open the relevant section in `docs/product-spec.md`.
3. Keep modules integrated with shared stock + kardex.

## Implementation checklist (any module)

- [ ] Schema in Postgres with clear FKs to `products` / movements
- [ ] RLS policies for roles that will use the screen
- [ ] Atomic writes for state changes (assign uniform, confirm / revise allocation, post physical count, stock linner)
- [ ] UI labels in Spanish; table/column names in English
- [ ] Update or respect stock formula: `+entradas −salidas`
- [ ] Surface alerts when `existencia < stock_minimo` after mutations

## Permissions (menu)

Source of truth: `src/lib/auth/modules.ts` + SQL `can_access_module`.

| Cargo | Módulos |
|-------|---------|
| Gerentes de Diseño y Estilo (`senior_design_manager`, `design_manager`) | Todos, incluido usuarios y entradas/salidas |
| `hr_manager` | Dashboard, uniformes |
| `laundry_supervisor` | Dashboard, blancos, uniformes, maquinaria |
| Supervisores de piso / `mrla` | Dashboard, inventario, inventario físico, reportes, alertas, dotación, linner recepción |

**Solicitud de insumos** se retiró de la app. No reintroducir rutas `/solicitudes`. Las tablas `supply_requests*` y `source_type = request` son legado.

## Module focus map

| User asks about | Spec section | Key invariants |
|-----------------|--------------|----------------|
| Catálogo / kardex | Inventario General, Entradas/Salidas | Movement log + stock update; gerentes escriben movimientos |
| Toallas / sábanas | Control de Blancos | State machine + quantities per state |
| Linners de piso / par / vueltas | Control de Blancos § linners | `sum(linners) <= available`; no kardex; vueltas = activa / (212 × piezas) |
| Linner de recepción | 3b. Stock del Linner de Recepción | No-blancos: kardex `reception_linner`; blancos: `stock_linner` a `REC` |
| Conteo | Inventario Físico | sistema vs físico + diferencia; vacío ≠ 0 |
| Stock mínimo | Alertas | Classification levels; `sin_conteo` fuera de alertas |
| Empleados / tallas | Uniformes | total = en_uso + disponible + no_utilizable; fijos/eventuales del padrón |
| Habitaciones | Amenidades por camarera | Configurable per-room params → salida; rectificar confirmada = delta |
| Lavadoras / equipos | Maquinaria | `laundry_machine` vs `room_equipment`; same tickets |
| Gráficas | Estadísticas | Occupancy (dirty/clean) vs real consumption; TZ `America/Caracas` |

## Prefer

- Server Actions + Supabase server client (`requireModuleAction`, no throw)
- Stock only via `stock_movements` / RPCs (guards block direct `quantity_on_hand`)
- Configurable parameters table for per-room amenity/linen quantities
- Dates via `src/lib/format/datetime.ts` (`America/Caracas`)
- Keep `can_access_module` (SQL) in sync with `src/lib/auth/modules.ts`

## Avoid

- Hardcoded amenity quantities in components
- Client-only stock updates without RLS
- Duplicate stock counters that can drift from movements
- Building a request/pedido module
- Writing kardex when stocking blancos into floor linners (they are a sub-location of `available`)
- Using a new enum value in the same migration that runs `ALTER TYPE ... ADD VALUE`
