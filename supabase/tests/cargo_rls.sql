-- RLS / integrity checks by cargo.
-- Impersonates live profiles via set local role authenticated + JWT sub.
-- All writes stay inside this transaction and are rolled back.

begin;

create temporary table cargo_rls_results (
  check_id text primary key,
  title text not null,
  expected text not null,
  observed text not null,
  passed boolean not null
) on commit drop;

do $$
declare
  manager_id uuid;
  floor_id uuid;
  hr_id uuid;
  laundry_id uuid;
  blanch_cat uuid;
  zero_product uuid;
  stock_product uuid;
  linen_product uuid;
  linen_id uuid;
  count_id uuid;
  line_id uuid;
  v_count integer;
  v_state text;
  v_msg text;
  v_uid uuid;
begin
  select id into strict manager_id
  from public.profiles
  where role = 'senior_design_manager' and is_active
  order by created_at
  limit 1;

  select p.id into strict floor_id
  from public.profiles p
  join public.departments d on d.id = p.department_id
  where p.role = 'floor_supervisor_a' and d.code = 'EST' and p.is_active
  order by p.created_at
  limit 1;

  select id into strict hr_id
  from public.profiles
  where role = 'hr_manager' and is_active
  order by created_at
  limit 1;

  select p.id into strict laundry_id
  from public.profiles p
  join public.departments d on d.id = p.department_id
  where p.role = 'laundry_supervisor' and d.code = 'LAV' and p.is_active
  order by p.created_at
  limit 1;

  select id into strict blanch_cat
  from public.product_categories
  where code = 'BLAN';

  insert into public.products (code, name, category_id, unit, min_stock, quantity_on_hand)
  values ('RLS-ZERO', 'Fixture sin stock', blanch_cat, 'und', 0, 0)
  returning id into zero_product;

  insert into public.products (code, name, category_id, unit, min_stock, quantity_on_hand)
  values ('RLS-STOCK', 'Fixture con stock', blanch_cat, 'und', 0, 0)
  returning id into stock_product;

  insert into public.stock_movements (
    product_id, movement_type, quantity, reason, responsible_user_id, source_type
  ) values (
    stock_product, 'in', 5, 'fixture rls', manager_id, 'manual'
  );

  insert into public.products (code, name, category_id, unit, min_stock, quantity_on_hand)
  values ('RLS-LINEN', 'Fixture blancos', blanch_cat, 'und', 0, 0)
  returning id into linen_product;

  insert into public.stock_movements (
    product_id, movement_type, quantity, reason, responsible_user_id, source_type
  ) values (
    linen_product, 'in', 3, 'fixture linen', manager_id, 'manual'
  );

  insert into public.linen_items (product_id, available)
  values (linen_product, 3)
  returning id into linen_id;

  insert into public.physical_counts (status, responsible_user_id, notes)
  values ('draft', floor_id, 'fixture rls')
  returning id into count_id;

  insert into public.physical_count_lines (count_id, product_id, system_qty, counted_qty)
  values (count_id, stock_product, 0, 5)
  returning id into line_id;

  -- -----------------------------------------------------------------------
  -- Inactive user sees 0 rows
  -- -----------------------------------------------------------------------
  update public.profiles set is_active = false where id = floor_id;

  perform set_config('request.jwt.claim.sub', floor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', floor_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  select auth.uid() into v_uid;
  select count(*) into v_count from public.products;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into cargo_rls_results values (
    '0-impersonation',
    'JWT sub + role authenticated',
    'auth.uid matches floor',
    coalesce(v_uid::text, 'null'),
    v_uid = floor_id
  );

  insert into cargo_rls_results values (
    '1-inactive-select',
    'Usuario inactivo: SELECT de products queda vacío',
    '0 rows',
    v_count::text || ' rows',
    v_count = 0
  );

  perform set_config('request.jwt.claim.sub', floor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', floor_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
  select count(*) into v_count from public.v_linen_summary;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into cargo_rls_results values (
    '1b-inactive-view',
    'Usuario inactivo: v_linen_summary queda vacío',
    '0 rows',
    v_count::text || ' rows',
    v_count = 0
  );

  update public.profiles set is_active = true where id = floor_id;

  -- -----------------------------------------------------------------------
  -- Floor cannot insert movements
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', floor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', floor_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'inserted';
  begin
    insert into public.stock_movements (
      product_id, movement_type, quantity, responsible_user_id, source_type
    ) values (
      stock_product, 'out', 1, floor_id, 'manual'
    );
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into cargo_rls_results values (
    '2-floor-movement',
    'Supervisor de piso no puede registrar movimientos',
    'SQLSTATE 42501',
    v_state || ': ' || v_msg,
    v_state = '42501'
  );

  -- -----------------------------------------------------------------------
  -- Floor can post a physical count
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', floor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', floor_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'posted';
  begin
    perform public.post_physical_count(count_id);
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into cargo_rls_results values (
    '3-floor-post-count',
    'Supervisor de piso puede cerrar un conteo',
    'success',
    v_state || ': ' || v_msg,
    v_state = '00000'
  );

  -- -----------------------------------------------------------------------
  -- HR cannot move linen; laundry can
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', hr_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', hr_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'moved';
  begin
    perform public.transition_linen(linen_id, 'available', 'in_laundry', 1);
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into cargo_rls_results values (
    '4-hr-linen',
    'Recursos Humanos no puede mover blancos',
    'exception',
    v_state || ': ' || v_msg,
    v_state <> '00000'
  );

  perform set_config('request.jwt.claim.sub', laundry_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', laundry_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'moved';
  begin
    perform public.transition_linen(linen_id, 'available', 'in_laundry', 1);
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into cargo_rls_results values (
    '5-laundry-linen',
    'Lavandería sí puede mover blancos',
    'success',
    v_state || ': ' || v_msg,
    v_state = '00000'
  );

  -- -----------------------------------------------------------------------
  -- Outbound without stock fails
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', manager_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'inserted';
  begin
    insert into public.stock_movements (
      product_id, movement_type, quantity, responsible_user_id, source_type
    ) values (
      zero_product, 'out', 1, manager_id, 'manual'
    );
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into cargo_rls_results values (
    '6-out-without-stock',
    'Una salida sin stock falla',
    'exception',
    v_state || ': ' || v_msg,
    v_state <> '00000'
  );

  -- -----------------------------------------------------------------------
  -- Direct quantity update fails for managers
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', manager_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  v_state := '00000';
  v_msg := 'updated';
  begin
    update public.products
    set quantity_on_hand = quantity_on_hand + 10
    where id = stock_product;
  exception
    when others then
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into cargo_rls_results values (
    '7-direct-qty-update',
    'UPDATE directo de existencia falla',
    'exception',
    v_state || ': ' || v_msg,
    v_state <> '00000'
  );

  -- -----------------------------------------------------------------------
  -- Active user can read the invoker view
  -- -----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', manager_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
  select count(*) into v_count from public.v_linen_summary;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into cargo_rls_results values (
    '8-view-rls-active',
    'Gerente activo lee v_linen_summary',
    '>0 rows',
    v_count::text || ' rows',
    v_count > 0
  );
end;
$$;

select check_id, title, expected, observed, passed
from cargo_rls_results
order by check_id;

select
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed
from cargo_rls_results;

rollback;
