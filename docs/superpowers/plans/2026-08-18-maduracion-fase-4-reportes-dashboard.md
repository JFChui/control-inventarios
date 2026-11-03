# Maduración Fase 4 — Reportes, Dashboard y Estadísticas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Start only after Fase 3 is in production.

**Goal:** Simplificar Reportes y mejorar Dashboard y Estadísticas usando solo consumo y ocupación reales (sin cifras inventadas).

**Architecture:** Reutilizar queries existentes de movimientos / `v_products_*` / `monthly_occupancy`; eliminar pestaña Consumo duplicada en Reportes; Dashboard añade resumen compacto con links; Estadísticas cruza ocupación vs salidas reales por categoría.

**Tech Stack:** Next.js Server Components + agregaciones SQL/Supabase.

**Depends on:** Fases 1–3 (datos operativos reales en kardex).

## Global Constraints

- No generar ni hardcodear series de consumo “demo”.
- Empty states explícitos cuando no hay `monthly_occupancy` o movimientos en el rango.
- No duplicar lógica de `classifyStock` — importar `src/lib/stock/status.ts`.

---

### Task 1: Reportes sin pestaña Consumo

**Files:**
- Modify: `src/app/(app)/reportes/page.tsx`

**Produces:** Solo Inventario actual + Bajo stock; labels “Stock mínimo”; mismos datos que alertas sin drift de reglas.

- [ ] **Step 1:** Quitar tab/sección Consumo.
- [ ] **Step 2:** Usar `classifyStock` para badges.
- [ ] **Step 3:** Commit `refactor: simplify reports to inventory and low stock`.

---

### Task 2: Dashboard consumo reciente

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Produces:** Bloque compacto: top salidas N días (producto, qty, link kardex `/inventario/[id]`) + link a Estadísticas / Movimientos. Si no hay datos, empty state.

- [ ] **Step 1:** Query agregada `stock_movements` type `out` últimos 7/30 días.
- [ ] **Step 2:** UI compacta sin cards innecesarias (seguir shell existente).
- [ ] **Step 3:** Commit `feat: dashboard recent real consumption summary`.

---

### Task 3: Estadísticas ocupación vs consumo

**Files:**
- Modify: `src/app/(app)/estadisticas/page.tsx`
- Modify: `src/app/actions/occupancy.ts` / forms si hace falta captura
- Optional view: `v_monthly_consumption_by_category`

**Produces:**
- Ocupación vs consumo real por categoría
- Variación mensual (mes actual vs anterior) cuando hay datos
- Empty states

- [ ] **Step 1:** SQL/vista de consumo por categoría y mes desde `stock_movements` + `products` + `product_categories`.
- [ ] **Step 2:** UI tablas/gráficas simples (sin lib pesada si no existe; HTML/CSS o SVG mínimo).
- [ ] **Step 3:** Tests de variación porcentual helper.
- [ ] **Step 4:** Commit `feat: occupancy vs real consumption statistics`.

---

### Task 4: Docs + ship Fase 4 (cierre maduración)

- [ ] Actualizar product-spec, manual, roadmap (todas las fases done).
- [ ] `npm test && npm run lint && npm run build` → push → smoke.
- [ ] Anunciar URL prod y checklist final de maduración.
