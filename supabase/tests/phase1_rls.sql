-- HISTÓRICO. Los cargos actuales se cubren en supabase/tests/cargo_rls.sql.
-- Phase 1 RLS / request-delivery checks
-- Run in the Supabase SQL Editor or MCP execute_sql as a single script.
-- Impersonates live profiles via set local role authenticated + JWT sub.
-- All writes stay inside this transaction and are rolled back.
-- Note: nextval() on supply_requests_request_number_seq is not rolled back
-- (Postgres sequence behavior). The script restores the sequence afterward.
-- After impersonation, clear request.jwt.claim.sub before updating profiles;
-- prevent_profile_role_escalation() only allows those writes when auth.uid()
-- is null (SQL Editor / service role).

begin;

create temporary table phase1_rls_results (
  check_id text primary key,
  title text not null,
  expected text not null,
  observed text not null,
  passed boolean not null
) on commit drop;

do $$
declare
  admin_id uuid;
  dept_user_id uuid;
  ama_id uuid;
  lav_id uuid;
  mapped_product uuid;
  unmapped_product uuid;
  pending_id uuid;
  approved_id uuid;
  approved_line_id uuid;
  seq_before bigint;
  v_count integer;
  v_state text;
  v_msg text;
  v_movements integer;
  v_movements_after integer;
  v_line_qty numeric;
  v_movement_qty numeric;
  v_cat_code text;
  v_uid uuid;
begin
  select last_value into seq_before
  from public.supply_requests_request_number_seq;

  select id into strict admin_id
  from public.profiles
  where role = 'admin'
  order by created_at
  limit 1;

  select id into strict dept_user_id
  from public.profiles
  where role = 'department_user'
  order by created_at
  limit 1;

  select id into strict ama_id
  from public.departments
  where code = 'AMA';

  select id into strict lav_id
  from public.departments
  where code = 'LAV';

  select id into strict mapped_product
  from public.products
  where code = 'AM-001';

  select id into strict unmapped_product
  from public.products
  where code = 'AM-002';

  -- Transactional fixtures only. Live department_user has no department and
  -- product_departments is empty until a manager assigns products.
  update public.profiles
  set department_id = ama_id
  where id = dept_user_id;

  insert into public.product_departments (product_id, department_id)
  values (mapped_product, ama_id)
  on conflict do nothing;

  insert into phase1_rls_results (check_id, title, expected, observed, passed)
  values (
    '0-impersonation',
    'JWT sub + role authenticated are usable in this environment',
    'auth.uid() matches the impersonated profile',
    'pending',
    false
  );

  -- -----------------------------------------------------------------------
  -- Check 1: inactive user cannot select or insert
  -- -----------------------------------------------------------------------
  update public.profiles
  set is_active = false
  where id = dept_user_id;

  perform set_config('request.jwt.claim.sub', dept_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', dept_user_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  select auth.uid() into v_uid;
  select count(*) into v_count from public.products;

  v_state := '00000';
  v_msg := 'inserted';
  begin
    insert into public.stock_movements (
      product_id, movement_type, quantity, department_id, responsible_user_id
    ) values (
      mapped_product, 'in', 1, ama_id, dept_user_id
    );
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  update phase1_rls_results
  set observed = format('auth.uid=%s', v_uid),
      passed = (v_uid = dept_user_id)
  where check_id = '0-impersonation';

  insert into phase1_rls_results
  values (
    '1a-inactive-select',
    'Usuario inactivo: SELECT de products queda vacío',
    '0 rows',
    v_count::text || ' rows',
    v_count = 0
  );

  insert into phase1_rls_results
  values (
    '1b-inactive-insert',
    'Usuario inactivo: INSERT de movimiento denegado',
    'SQLSTATE 42501',
    v_state || ': ' || v_msg,
    v_state = '42501'
  );

  -- prevent_profile_role_escalation() allows service updates only when
  -- auth.uid() is null. Clear JWT before flipping the fixture flag back.
  update public.profiles
  set is_active = true
  where id = dept_user_id;

  -- -----------------------------------------------------------------------
  -- Checks 2-3: department_user movement gates
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', dept_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', dept_user_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'inserted';
  begin
    insert into public.stock_movements (
      product_id, movement_type, quantity, department_id, responsible_user_id
    ) values (
      mapped_product, 'in', 1, lav_id, dept_user_id
    );
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  insert into phase1_rls_results
  values (
    '2-cross-dept',
    'department_user no inserta movimiento de otro depto',
    'SQLSTATE 42501',
    v_state || ': ' || v_msg,
    v_state = '42501'
  );

  perform set_config('request.jwt.claim.sub', dept_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', dept_user_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'inserted';
  begin
    insert into public.stock_movements (
      product_id, movement_type, quantity, department_id, responsible_user_id
    ) values (
      unmapped_product, 'in', 1, ama_id, dept_user_id
    );
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  insert into phase1_rls_results
  values (
    '3-unmapped-product',
    'department_user no usa producto no habilitado',
    'SQLSTATE 42501',
    v_state || ': ' || v_msg,
    v_state = '42501'
  );

  perform set_config('request.jwt.claim.sub', dept_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', dept_user_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'inserted';
  begin
    insert into public.stock_movements (
      product_id, movement_type, quantity, department_id, responsible_user_id
    ) values (
      mapped_product, 'in', 1, ama_id, dept_user_id
    );
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  insert into phase1_rls_results
  values (
    '3b-own-dept-mapped',
    'Control: department_user sí inserta depto propio + producto habilitado',
    'SQLSTATE 00000',
    v_state || ': ' || v_msg,
    v_state = '00000'
  );

  -- -----------------------------------------------------------------------
  -- Checks 4-5: deliver_supply_request gates
  -- -----------------------------------------------------------------------
  insert into public.supply_requests (
    department_id, requested_by, status, notes
  ) values (
    ama_id, dept_user_id, 'pending', 'phase1 rls pending fixture'
  )
  returning id into pending_id;

  insert into public.supply_request_lines (
    request_id, product_id, quantity_requested
  ) values (
    pending_id, mapped_product, 1
  );

  insert into public.supply_requests (
    department_id, requested_by, status, notes
  ) values (
    ama_id, dept_user_id, 'approved', 'phase1 rls approved fixture'
  )
  returning id into approved_id;

  insert into public.supply_request_lines (
    request_id, product_id, quantity_requested, quantity_approved
  ) values (
    approved_id, mapped_product, 1, 1
  )
  returning id into approved_line_id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'delivered';
  begin
    perform public.deliver_supply_request(pending_id);
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  insert into phase1_rls_results
  values (
    '4-deliver-pending',
    'deliver_supply_request en pending → error',
    'Solo se pueden entregar solicitudes aprobadas',
    v_state || ': ' || v_msg,
    v_state = 'P0001'
      and v_msg like '%Solo se pueden entregar solicitudes aprobadas%'
  );

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'quantity updated';
  begin
    perform public.update_supply_request_line_qty(approved_line_id, 0.5);
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  select quantity_approved into v_line_qty
  from public.supply_request_lines
  where id = approved_line_id;

  insert into phase1_rls_results
  values (
    '4b-serialized-qty-update',
    'RPC actualiza cantidad mientras la solicitud es aprobada',
    'SQLSTATE 00000; quantity_approved=0.5',
    format('%s: %s; quantity_approved=%s', v_state, v_msg, v_line_qty),
    v_state = '00000' and v_line_qty = 0.5
  );

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'direct update unexpectedly succeeded';
  begin
    update public.supply_request_lines
    set quantity_approved = 0.75
    where id = approved_line_id;
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  insert into phase1_rls_results
  values (
    '4c-direct-qty-update-blocked',
    'UPDATE directo de cantidad está bloqueado',
    'SQLSTATE 42501',
    v_state || ': ' || v_msg,
    v_state = '42501'
  );

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'first deliver ok';
  begin
    perform public.deliver_supply_request(approved_id);
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;

  select quantity_approved into v_line_qty
  from public.supply_request_lines
  where id = approved_line_id;

  select max(quantity) into v_movement_qty
  from public.stock_movements
  where source_type = 'request'
    and source_id = approved_id
    and notes = 'supply_request_line:' || approved_line_id::text;

  insert into phase1_rls_results
  values (
    '5a-delivered-qty-matches-kardex',
    'Cantidad entregada coincide con la salida de kardex',
    'line=0.5; movement=0.5',
    format('line=%s; movement=%s', v_line_qty, v_movement_qty),
    v_line_qty = 0.5 and v_movement_qty = 0.5
  );

  select count(*) into v_movements
  from public.stock_movements
  where source_type = 'request'
    and source_id = approved_id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  begin
    perform public.deliver_supply_request(approved_id);
    v_state := v_state || '+second=00000';
    v_msg := v_msg || '; second delivered';
  exception
    when others then
      v_state := v_state || '+second=' || sqlstate;
      v_msg := v_msg || '; ' || sqlerrm;
  end;

  reset role;

  select count(*) into v_movements_after
  from public.stock_movements
  where source_type = 'request'
    and source_id = approved_id;

  insert into phase1_rls_results
  values (
    '5-double-deliver',
    'Doble deliver → error idempotente (sin segunda salida)',
    'first 00000; second P0001; movements=1',
    format(
      '%s | movements %s→%s | %s',
      v_state,
      v_movements,
      v_movements_after,
      v_msg
    ),
    v_state like '00000+second=P0001'
      and v_movements = 1
      and v_movements_after = 1
      and v_msg like '%Solo se pueden entregar solicitudes aprobadas%'
  );

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'quantity updated after delivery';
  begin
    perform public.update_supply_request_line_qty(approved_line_id, 0.75);
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  insert into phase1_rls_results
  values (
    '5c-delivered-qty-immutable',
    'RPC rechaza cambios después de entregar',
    'SQLSTATE P0001',
    v_state || ': ' || v_msg,
    v_state = 'P0001'
      and v_msg like '%Solo se pueden modificar solicitudes pendientes o aprobadas%'
  );

  -- -----------------------------------------------------------------------
  -- Check 6: catalog write is admin/mrla only
  -- -----------------------------------------------------------------------
  v_cat_code := 'QA-P1-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'inserted';
  begin
    insert into public.product_categories (code, name)
    values (v_cat_code, 'QA Phase1 RLS');
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  insert into phase1_rls_results
  values (
    '6a-admin-category',
    'Admin crea categoría',
    'SQLSTATE 00000',
    v_state || ': ' || v_msg,
    v_state = '00000'
  );

  perform set_config('request.jwt.claim.sub', dept_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', dept_user_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'inserted';
  begin
    insert into public.product_categories (code, name)
    values (v_cat_code || 'X', 'QA Phase1 RLS blocked');
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  insert into phase1_rls_results
  values (
    '6b-dept-category',
    'department_user no crea categoría',
    'SQLSTATE 42501',
    v_state || ': ' || v_msg,
    v_state = '42501'
  );

  if (
    select last_value
    from public.supply_requests_request_number_seq
  ) is distinct from seq_before then
    perform setval(
      'public.supply_requests_request_number_seq',
      seq_before,
      true
    );
  end if;
end
$$;

select check_id, title, expected, observed, passed
from phase1_rls_results
order by check_id;

rollback;
