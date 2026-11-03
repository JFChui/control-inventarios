-- Task 2 review fixes: department read scope, atomic request creation,
-- and active product/department enforcement for department movements.

drop policy if exists stock_movements_select_authenticated
  on public.stock_movements;
create policy stock_movements_select_authenticated
  on public.stock_movements for select
  to authenticated
  using (
    (select public.is_active_user())
    and (
      (select public.current_app_role()) in ('admin', 'mrla')
      or (
        (select public.current_app_role()) = 'department_user'
        and stock_movements.department_id =
          (select public.current_department_id())
      )
    )
  );

drop policy if exists product_departments_select
  on public.product_departments;
create policy product_departments_select
  on public.product_departments for select
  to authenticated
  using (
    (select public.is_active_user())
    and (
      (select public.current_app_role()) in ('admin', 'mrla')
      or (
        (select public.current_app_role()) = 'department_user'
        and product_departments.department_id =
          (select public.current_department_id())
      )
    )
  );

-- Request headers and lines may only be created by the atomic
-- create_supply_request() SECURITY DEFINER RPC.
drop policy if exists supply_requests_insert
  on public.supply_requests;
drop policy if exists supply_request_lines_insert
  on public.supply_request_lines;
revoke insert on table public.supply_requests from authenticated;
revoke insert on table public.supply_request_lines from authenticated;

drop policy if exists stock_movements_insert
  on public.stock_movements;
create policy stock_movements_insert
  on public.stock_movements for insert
  to authenticated
  with check (
    (select public.is_active_user())
    and (
      (select public.current_app_role()) in ('admin', 'mrla')
      or (
        (select public.current_app_role()) = 'department_user'
        and stock_movements.department_id =
          (select public.current_department_id())
        and (
          select public.product_enabled_for_dept(
            stock_movements.product_id,
            stock_movements.department_id
          )
        )
      )
    )
  );
