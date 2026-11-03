---
name: project-lessons
description: >-
  Operational lessons for Hotel Demo inventory (Next.js, Supabase, Vercel,
  Cursor MCP, RLS, deploy, auth). Use when debugging 500s on profiles, setting up
  env/MCP, deploying, pushing to GitHub, fixing stock/RLS, or when the user asks
  for lessons learned, contexto del proyecto, or how we configured the stack.
---

# Project lessons (ops)

Read `docs/lessons-learned.md` first for full detail. Apply these rules on every ops/debug task.

## Always

1. Prefer **rules + docs + skills** over inventing a one-off custom agent.
2. Keep secrets out of git; rotate anything pasted in chat. Account passwords are **not** in `docs/cuentas-de-acceso.md`.
3. Schema changes → versioned file under `supabase/migrations/` + apply via Supabase MCP `apply_migration`. After MCP, the local filename version must match `list_migrations`. `ALTER TYPE ... ADD VALUE` goes in its **own** migration; Postgres cannot use the new enum value in the same transaction.
4. Library API doubts → Context7 MCP.
5. After real code/docs/rules changes: **commit → push → Vercel deploy** (see `.cursor/rules/ship-on-change.mdc`). Default in this project; do not wait for “haz push”.

## Known fix: profiles 500 / RLS recursion

If `profiles` select fails after login:

- Cause: policies querying `profiles` inside `profiles` RLS.
- Fix already documented in migration `20260816185000_fix_profile_rls_recursion.sql`.
- Role checks must use `SECURITY DEFINER` helpers with `set search_path = public`.

Do not reintroduce `EXISTS (SELECT 1 FROM profiles …)` inside policies without a definer helper.

`apply_stock_movement` must remain `SECURITY DEFINER`. Direct updates to `products.quantity_on_hand` by `authenticated`/`anon` are blocked.

Views `v_linen_summary` and `v_monthly_consumption_by_category` must stay `security_invoker = true`.

## Permissions map

UI: `src/lib/auth/modules.ts`. Session gate: `src/proxy.ts` (not `middleware.ts`).

| Acción | Cargos |
|--------|--------|
| Catálogo, departamentos, movimientos, usuarios | `senior_design_manager`, `design_manager` (legado `admin`) |
| Restablecer contraseña | mismos gerentes, nunca sobre la propia cuenta |
| Uniformes | gerentes + `hr_manager` + `laundry_supervisor` |
| Blancos / maquinaria | gerentes + `laundry_supervisor` |
| Conteo físico / dotación / linner recepción | gerentes + supervisores de piso / `mrla` |
| Lectura de inventario (RLS) | autenticado **y** `is_active` |

Inactive users cannot read or write. Enforce in Server Actions (`requireModuleAction`) **and** rely on RLS.

## Env / IDs

- Supabase URL base only (no `/rest/v1/`).
- Project ref: `YOUR_PROJECT_REF`
- Vercel project: `your-team/control-inventarios`
- Prod app: https://your-app.vercel.app
- Hotel TZ: `America/Caracas` (`src/lib/format/datetime.ts`)

Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server, required).

## Deploy smoke

1. `/login` 200
2. `/` redirects when logged out
3. Gerente ve Departamentos/Usuarios; supervisor de piso no ve Entradas/salidas
4. Lavandería ve Blancos y Maquinaria
5. Movement updates `quantity_on_hand` via trigger (only managers in UI)
6. Uninitialized catalog items are `sin_conteo` and **not** in `v_products_low_stock`
7. Empty physical-count field does not save 0
8. Datetimes show Venezuela time
9. `GET /api/health` is public (Vercel cron keep-alive)
10. Floor supervisor sees Stock linner recepción; laundry does not

## Stock invariant

Never bypass `stock_movements` for quantity changes unless an explicit, documented exception.

Documented exceptions: moving blancos between lavandería and linners (`stock_linner` / `return_from_linner`) does **not** write kardex (sub-location of `available`). Sending non-linen products to the reception linner **does** write an `out` with `source_type = reception_linner`.

## Related

- Índice de docs: `docs/README.md`
- Piso: `docs/manual-usuario.md` · IT: `docs/manual-sistemas.md` · cuentas: `docs/cuentas-de-acceso.md`
- Domain modules: skill `hotel-inventory-domain` + `docs/product-spec.md`
- RLS vigente: `docs/qa/rls-cargos-checklist.md`
