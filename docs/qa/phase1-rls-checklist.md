# Phase 1 — checklist SQL / RLS (**histórico**)

**No usar para QA actual.** La prueba vigente es [`rls-cargos-checklist.md`](rls-cargos-checklist.md) (`supabase/tests/cargo_rls.sql`). Este documento describe los seis gates de agosto 2026 con roles `admin` / `department_user` y el módulo Solicitudes, ya retirado de la UI.

Reproducible checks for the six Phase 1 gates. Script: `supabase/tests/phase1_rls.sql`.

Do not weaken RLS to make a check pass.

## How to run

1. Open the Supabase SQL Editor (or MCP `execute_sql`).
2. Paste `supabase/tests/phase1_rls.sql` as a single script.
3. Run it. The script impersonates with:

   ```sql
   set local role authenticated;
   select set_config('request.jwt.claim.sub', '<profile-id>', true);
   select set_config(
     'request.jwt.claims',
     json_build_object('sub', '<profile-id>', 'role', 'authenticated')::text,
     true
   );
   ```

4. It creates fixtures, records results, then `ROLLBACK`.
5. After impersonation, the script clears JWT claims before updating `profiles`. `prevent_profile_role_escalation()` only allows those writes when `auth.uid()` is null.

If JWT impersonation is unavailable, use the manual fallback below (login as each live user). There is no third seed user in this project.

## Live actors (2026-08-18)

Historical snapshot. In October 2026 the accounts `cliente@example.local` and `admin@examplegmail.local` were deleted. For a manual fallback today use `admin@example.local` and a live `department_user` such as `estilo@example.local`.

| Actor | Role | Profile id | `department_id` | `is_active` |
| --- | --- | --- | --- | --- |
| Administrador | `admin` | `905f59bf-f722-4d7e-afeb-15c8212f0516` | null | true |
| Usuario Cliente | `department_user` | `18e4e5bb-4edf-4e09-bed9-e608ec9ce820` | null | true |

No `mrla`, `human_resources`, or inactive profile exists. The script assigns AMA and flips `is_active` only inside the rolled-back transaction.

## Transactional fixtures

| Fixture | Value |
| --- | --- |
| Own department | `AMA` (`f5f2ae0c-c380-4953-babd-fab80bc5c206`) |
| Other department | `LAV` (`e18613d5-58bd-4145-92ce-bdc671f4979b`) |
| Enabled product | `AM-001` Jabón de tocador |
| Unenabled product | `AM-002` Shampoo |
| Mapping | `AM-001` → `AMA` (live `product_departments` starts empty) |

## Results — 2026-08-18 via Supabase MCP `execute_sql`

Environment: JWT impersonation **works**. All writes rolled back. Live state after run: profiles unchanged, `product_departments` = 0, no `QA-P1-%` categories, 2 delivered requests, sequence `last_value` still 5.

| # | Check | Expected | Observed | Pass |
| --- | --- | --- | --- | --- |
| 0 | Impersonation (`auth.uid()`) | department-user id | `18e4e5bb-4edf-4e09-bed9-e608ec9ce820` | PASS |
| 1a | Inactive SELECT `products` | 0 rows | 0 rows | PASS |
| 1b | Inactive INSERT movement | `42501` | RLS policy on `stock_movements` | PASS |
| 2 | `department_user` movement to `LAV` | `42501` | RLS policy on `stock_movements` | PASS |
| 3 | `department_user` movement of `AM-002` | `42501` | RLS policy on `stock_movements` | PASS |
| 3b | Control: own dept + `AM-001` | insert ok | `00000` | PASS |
| 4 | `deliver_supply_request` on `pending` | `Solo se pueden entregar solicitudes aprobadas` | `P0001` same message | PASS |
| 5 | Second deliver on same request | `P0001`; movements stay 1 | `00000+second=P0001`; movements `1→1` | PASS |
| 6a | Admin INSERT category | insert ok | `00000` | PASS |
| 6b | `department_user` INSERT category | `42501` | RLS policy on `product_categories` | PASS |

**10 / 10 passed. RLS was not changed.**

## Task 2 evidence (same gates, earlier run)

From `.superpowers/sdd/task-2-report.md` (transactional fixtures + `ROLLBACK`):

- Own department + mapped product movement succeeded; stock changed only via `stock_movements_apply_stock`.
- Cross-department movement rejected by RLS (`42501`).
- Unassigned product movement rejected by RLS (`42501`).
- Synthetic pending request rejected by `deliver_supply_request` with `Solo se pueden entregar solicitudes aprobadas`.
- After review fixes: department user saw only own department movements/mappings; direct INSERT on `supply_requests` / `supply_request_lines` denied (`42501`); inactive-department movement denied; creation is RPC-only.

This checklist re-ran those gates plus inactive-user reads/writes, double-deliver idempotency, and category write split.

## Manual fallback (no JWT impersonation)

Use the two live users. A manager must first map at least one product to AMA and assign Usuario Cliente to AMA.

1. **Inactive:** as admin, set Usuario Cliente `is_active = false`. That user must see empty catalog and fail any movement. Re-activate immediately.
2. **Other department:** as Usuario Cliente, insert a movement for LAV. Must fail.
3. **Unenabled product:** as Usuario Cliente, insert a movement for a product not in `product_departments` for AMA. Must fail.
4. **Deliver pending:** as admin, call `deliver_supply_request` on a `pending` request. Must raise the Spanish approved-only error.
5. **Double deliver:** deliver an `approved` request, then deliver again. Second call must error; kardex for that `source_id` must stay one `out` row.
6. **Category:** admin can create a category; Usuario Cliente cannot.

## Policies involved (do not loosen)

- Reads require `is_active_user()`.
- `stock_movements` INSERT: `admin`/`mrla` global; `department_user` only `current_department_id()` + `product_enabled_for_dept(...)`.
- `product_categories` write: `has_manage_role()` → `admin`/`mrla`.
- `deliver_supply_request` requires `has_manage_catalog()` and `status = approved`. A delivered row fails the same status check, so a second deliver cannot insert another salida.
