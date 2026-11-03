# Maduración Fase 2 — Blancos e Inventario Físico

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Expand any step that feels underspecified before coding; do not start until Fase 1 is shipped and smoked in prod.

**Goal:** Alinear Control de Blancos con el stock compartido y robustecer Inventario Físico (alcance, diferencias, cierre atómico inmutable).

**Architecture:** `linen_items` deja de ser un inventario paralelo: la suma activa de estados debe reconciliarse con `products.quantity_on_hand`; `written_off` es histórico y genera un único movimiento `out` al pasar a baja. Inventario físico amplía `physical_counts` con departamento, notas, progreso y post atómico ya existente (`post_physical_count`) endurecido.

**Tech Stack:** Igual que Fase 1 (Next.js + Supabase + Vitest).

**Depends on:** Fase 1 completa (roles, product_departments, RLS).

## Global Constraints

- Hereda Global Constraints del roadmap y de Fase 1.
- `available + in_use + in_laundry + damaged` (= activo) debe igualar `products.quantity_on_hand` del producto blanco tras cada transición que mueva unidades activas.
- `written_off` no cuenta en existencia; al escribir baja → un `stock_movements` `out` con `source_type` adecuado (idempotente por linen id + qty).
- Umbrales diferencia menor: **5 unidades o 5%** (el que se cumpla según regla actual del código; documentar la exacta en UI).
- Cierre de conteo: inmutable (`posted`); no editar líneas tras post.

---

### Task 1: Migración reconciliación blancos

**Files:**
- Create: `supabase/migrations/20260819010000_phase2_linen_stock_reconcile.sql`
- Modify: `src/app/actions/linen.ts` (o crear si la lógica está solo en RPC)

**Produces:**
- Función `transition_linen` actualizada: al pasar a `written_off`, insertar movimiento kardex una sola vez.
- Constraint o función `assert_linen_matches_product(product_id)` callable tras transiciones.
- Vista `v_linen_summary` para UI: producto, total activo, por estado, `quantity_on_hand`, `drift`.

- [ ] **Step 1:** Escribir migración + aplicar vía MCP/CLI.
- [ ] **Step 2:** Seed/fix: producto con linen; transición a baja reduce `quantity_on_hand`.
- [ ] **Step 3:** Commit `db: reconcile linen states with shared stock kardex`.

---

### Task 2: UI Blancos — resumen + detalle estados

**Files:**
- Modify: `src/app/(app)/blancos/page.tsx`
- Modify: `src/components/linen/linen-transition-form.tsx`
- Modify: `src/components/linen/linen-create-form.tsx`

**Produces:** Página principal = tabla todos los productos categoría Blancos (código, nombre, existencia sistema, Disponible, En uso, En lavandería, Dañado, Baja). Detalle secundario con transiciones.

- [ ] **Step 1:** Query join `products` + `linen_items` + categoría Blancos.
- [ ] **Step 2:** Mostrar drift si activo ≠ `quantity_on_hand` (alerta UI).
- [ ] **Step 3:** Commit `feat: blancos summary aligned to shared stock`.

---

### Task 3: Inventario Físico robusto

**Files:**
- Modify: `supabase/migrations/…` o nueva migración si faltan columnas: `physical_counts.department_id`, `notes`, timestamps de cierre
- Modify: `src/app/(app)/inventario-fisico/page.tsx`
- Modify: `src/components/physical/count-controls.tsx`
- Modify: `src/app/actions/physical.ts`
- Modify: `post_physical_count` si hace falta alcance/notas

**Produces:**
- Crear conteo con departamento opcional/filtrado por `product_departments`
- Progreso: líneas contadas / total
- Resumen diferencias: Sistema | Conteo físico | Diferencia
- Marcar diferencia menor (5 uds o 5%) vs mayor
- Cierre atómico; UI bloquea edición si `posted`

- [ ] **Step 1:** Schema + RLS (solo manage puede postear).
- [ ] **Step 2:** UI progreso + tabla diferencias.
- [ ] **Step 3:** Test unitario de helper `isMinorVariance(system, counted)`.
- [ ] **Step 4:** Commit `feat: physical count scope progress and immutable close`.

---

### Task 4: Docs + ship Fase 2

- [ ] Actualizar `docs/product-spec.md` (Blancos, Inventario Físico).
- [ ] `npm test && npm run lint && npm run build`
- [ ] Push `main` + smoke prod blancos + cierre conteo.
- [ ] Actualizar roadmap; escribir plan detallado Fase 3 solo después.
