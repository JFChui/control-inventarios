# Checklist RLS por cargo

Prueba vigente: `supabase/tests/cargo_rls.sql`.

El script [phase1-rls-checklist.md](phase1-rls-checklist.md) y `supabase/tests/phase1_rls.sql` son **históricos** (roles `admin` / `department_user` y módulo Solicitudes).

## Cómo correrla

1. MCP `execute_sql` (o SQL Editor) con el archivo completo.
2. El script lee actores vivos en `profiles` (gerente, RR.HH., lavandería, supervisor de piso), crea fixtures y termina en `ROLLBACK`.
3. Meta: todas las filas de `cargo_rls_results` con `passed = true`.

No debilitar RLS para que un check pase.

## Casos cubiertos

1. Usuario inactivo ve 0 filas de negocio.
2. Supervisor de piso no inserta movimientos; sí puede cerrar un conteo de su alcance.
3. Recursos Humanos no transiciona blancos; Lavandería sí.
4. Una salida sin stock falla.
5. Un `UPDATE` directo de `products.quantity_on_hand` como `authenticated` falla (el stock solo cambia por kardex / RPCs).
6. Las vistas `v_linen_summary` y `v_monthly_consumption_by_category` respetan RLS (`security_invoker`).
7. Supervisor de piso **lee** `machines` / `linen_items` / `uniform_*` vía `can_access_module('reportes')`; no escribe tickets ni transiciona blancos.
8. Supervisor de piso lee `reception_linner_stock`; lavandería no (módulo `linner_recepcion`).
9. Conteos de una dotación `confirmed` no se editan por API autenticada (solo RPC `revise_maid_allocation`).

## Advisors

Tras cambios de schema: `get_advisors` security. Meta: 0 ERROR. Los WARN de funciones SECURITY DEFINER autenticadas (RPCs de negocio) se revisan; no deben quedar EXECUTE para `anon` en triggers.
