# Maduración Fase 3 — Dotación, Uniformes y Maquinaria

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Start only after Fase 2 is in production.

**Goal:** Robustecer Dotación por camarera, Uniformes y Maquinaria según `docs/product-spec.md`, con operaciones atómicas y stock compartido.

**Architecture:** Dotación confirma una vez y genera salidas atómicas (`confirm_maid_allocation`). Uniformes preservan `total = available + in_use` con assign/return atómicos. Maquinaria sigue máquina de estados de tickets con historial.

**Tech Stack:** Next.js + Supabase + Vitest.

**Depends on:** Fases 1–2.

## Global Constraints

- Hereda roadmap + Fases 1–2.
- Dotación: cantidades desde `room_supply_params` (nunca hardcode en UI).
- Uniformes: `human_resources` + `admin` (y `mrla` solo si product-spec lo permite; default HR+admin).
- Confirmación de dotación / assign uniforme / transición ticket: una sola escritura atómica (RPC).

---

### Task 1: Dotación por camarera

**Files:**
- Modify: `src/app/(app)/dotacion/page.tsx`
- Modify: `src/components/maid/maid-forms.tsx`
- Modify: `src/app/actions/maid.ts`
- Possibly migrate: columnas habitación número/estado si faltan

**Produces:**
- Habitaciones estructuradas (número, estado/tipo servicio)
- Preview separado Amenidades vs Lencería
- Edición de borradores + historial por camarera
- Confirmar una vez → RPC genera salidas; no doble confirm

- [ ] **Step 1:** UI draft + preview.
- [ ] **Step 2:** Wire `confirm_maid_allocation`; manejar error stock insuficiente.
- [ ] **Step 3:** Test de cálculo de líneas desde params (función pura).
- [ ] **Step 4:** Commit `feat: maid allocation draft preview and atomic confirm`.

---

### Task 2: Uniformes

**Files:**
- Modify: `src/app/(app)/uniformes/page.tsx`
- Modify: `src/components/uniforms/uniforms-forms.tsx`
- Modify: `src/app/actions/uniforms.ts`
- Migrate si hace falta: audit log de ajustes de stock de SKU

**Produces:**
- CRUD SKU/talla
- Ajustes auditados (movimiento o tabla `uniform_sku_adjustments`)
- Filtros trabajador / departamento / talla / estado
- Historial asignaciones
- assign/return atómicos; invariante `available + in_use = total`

- [ ] **Step 1:** CRUD + filtros.
- [ ] **Step 2:** Assign/return UI + errores claros.
- [ ] **Step 3:** Test invariante helper.
- [ ] **Step 4:** Commit `feat: uniforms CRUD filters and atomic assign-return`.

---

### Task 3: Maquinaria

**Files:**
- Modify: `src/app/(app)/maquinaria/page.tsx`
- Modify: `src/components/machines/machine-forms.tsx`
- Modify: `src/app/actions/machines.ts`
- Migrate: campos responsable lavandería, fechas entrega/reparación si faltan

**Produces:**
- CRUD equipos
- Tickets: Reportada → Entregada → En reparación → Reparada | Fuera de servicio (solo transiciones válidas)
- Detalle + historial

- [ ] **Step 1:** Schema + constraint/check de transición (función).
- [ ] **Step 2:** UI CRUD + workflow.
- [ ] **Step 3:** Commit `feat: machines CRUD and ticket state machine`.

---

### Task 4: Docs + ship Fase 3

- [ ] Spec + manual usuario.
- [ ] `npm test && npm run lint && npm run build` → push → smoke prod.
- [ ] Actualizar roadmap; plan detallado Fase 4 después.
