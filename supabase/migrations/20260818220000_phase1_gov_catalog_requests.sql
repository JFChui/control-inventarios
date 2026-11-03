-- Phase 1: governance, catalog assignments, request atomics, and RLS hardening.
-- Stock remains derived exclusively from stock_movements via the existing trigger.

-- ---------------------------------------------------------------------------
-- 1. Active-user and password-governance flags
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists must_change_password boolean not null default false;

alter table public.departments
  add column if not exists is_active boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Replace the role enum without retaining legacy values
-- ---------------------------------------------------------------------------
-- current_app_role() has app_role as its return type, so it must be dropped
-- before the old type can be removed.
drop function if exists public.current_app_role();

create type public.app_role_v2 as enum (
  'admin',
  'mrla',
  'human_resources',
  'department_user'
);

alter table public.profiles
  alter column role drop default;

alter table public.profiles
  add column role_v2 public.app_role_v2;

update public.profiles
set role_v2 = case role::text
  when 'admin' then 'admin'::public.app_role_v2
  when 'supervisor' then 'mrla'::public.app_role_v2
  when 'staff' then 'department_user'::public.app_role_v2
  when 'readonly' then 'department_user'::public.app_role_v2
  else 'department_user'::public.app_role_v2
end;

alter table public.profiles
  drop column role;

alter table public.profiles
  rename column role_v2 to role;

alter table public.profiles
  alter column role set not null,
  alter column role set default 'department_user'::public.app_role_v2;

drop type public.app_role;
alter type public.app_role_v2 rename to app_role;

create index if not exists profiles_role_idx
  on public.profiles (role);

-- ---------------------------------------------------------------------------
-- 3. Products enabled per department
-- ---------------------------------------------------------------------------
create table if not exists public.product_departments (
  product_id uuid not null references public.products (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, department_id)
);

create index if not exists product_departments_department_id_idx
  on public.product_departments (department_id);

alter table public.product_departments enable row level security;

-- ---------------------------------------------------------------------------
-- 4. RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_active from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true;
$$;

create or replace function public.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id
  from public.profiles
  where id = auth.uid()
    and is_active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin';
$$;

create or replace function public.is_mrla()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'mrla';
$$;

create or replace function public.is_hr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'human_resources';
$$;

create or replace function public.is_department_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'department_user';
$$;

create or replace function public.has_manage_catalog()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin', 'mrla');
$$;

create or replace function public.has_write_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin', 'mrla', 'department_user');
$$;

create or replace function public.has_hr_scope()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin', 'human_resources');
$$;

create or replace function public.product_enabled_for_dept(
  p_product_id uuid,
  p_department_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
    and exists (
      select 1
      from public.product_departments pd
      join public.products p on p.id = pd.product_id
      join public.departments d on d.id = pd.department_id
      where pd.product_id = p_product_id
        and pd.department_id = p_department_id
        and p.is_active = true
        and d.is_active = true
    );
$$;

-- Compatibility helpers used by existing policies and RPCs.
create or replace function public.has_manage_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_manage_catalog();
$$;

create or replace function public.has_write_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and public.has_write_ops();
$$;

-- Keep newly-created profiles aligned with the new enum.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'department_user'
  );
  return new;
end;
$$;

-- Users may edit their own display name and clear must_change_password, but
-- only an active admin may change governed profile fields.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not coalesce(public.is_admin(), false) then
    if new.role is distinct from old.role then
      raise exception 'Solo un admin puede cambiar roles';
    end if;

    if new.department_id is distinct from old.department_id
      or new.is_active is distinct from old.is_active then
      raise exception 'Solo un admin puede cambiar el departamento o estado de un usuario';
    end if;

    if new.must_change_password = true
      and new.must_change_password is distinct from old.must_change_password then
      raise exception 'Solo un admin puede exigir un cambio de contraseña';
    end if;
  end if;

  return new;
end;
$$;

-- Uniform RPCs are SECURITY DEFINER, so their internal guards must match the
-- Human Resources policies rather than relying on table RLS.
create or replace function public.assign_uniform(
  p_sku_id uuid,
  p_worker_name text,
  p_qty numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sku public.uniform_skus%rowtype;
  new_id uuid;
begin
  if not public.has_hr_scope() then
    raise exception 'Sin permiso para asignar uniformes';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;

  select *
  into sku
  from public.uniform_skus
  where id = p_sku_id
  for update;

  if not found then
    raise exception 'Uniforme no encontrado';
  end if;

  if sku.available < p_qty then
    raise exception 'No hay suficientes uniformes disponibles';
  end if;

  update public.uniform_skus
  set available = available - p_qty,
      in_use = in_use + p_qty,
      updated_at = now()
  where id = p_sku_id;

  insert into public.uniform_assignments (
    sku_id,
    worker_name,
    quantity,
    assigned_by,
    notes
  )
  values (
    p_sku_id,
    trim(p_worker_name),
    p_qty,
    auth.uid(),
    p_notes
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.return_uniform(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.uniform_assignments%rowtype;
begin
  if not public.has_hr_scope() then
    raise exception 'Sin permiso para devolver uniformes';
  end if;

  select *
  into a
  from public.uniform_assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'Asignación no encontrada';
  end if;

  if a.returned_at is not null then
    raise exception 'Ya fue devuelto';
  end if;

  update public.uniform_skus
  set available = available + a.quantity,
      in_use = in_use - a.quantity,
      updated_at = now()
  where id = a.sku_id;

  update public.uniform_assignments
  set returned_at = now()
  where id = p_assignment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Atomic supply-request creation and approved-only delivery
-- ---------------------------------------------------------------------------
create or replace function public.create_supply_request(
  p_department_id uuid,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_role public.app_role;
  v_department_id uuid;
  v_line_count integer;
  v_distinct_product_count integer;
begin
  if not public.is_active_user() or not public.has_write_ops() then
    raise exception 'Sin permiso para crear solicitudes';
  end if;

  v_role := public.current_app_role();
  v_department_id := public.current_department_id();

  if p_department_id is null then
    raise exception 'El departamento es obligatorio';
  end if;

  if not exists (
    select 1
    from public.departments d
    where d.id = p_department_id
      and d.is_active = true
  ) then
    raise exception 'Departamento inexistente o inactivo';
  end if;

  if v_role = 'department_user'
    and (
      v_department_id is null
      or p_department_id is distinct from v_department_id
    ) then
    raise exception 'Solo puedes crear solicitudes para tu departamento';
  end if;

  if p_lines is null
    or jsonb_typeof(p_lines) is distinct from 'array'
    or jsonb_array_length(p_lines) = 0 then
    raise exception 'Agrega al menos un producto con cantidad';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) item
    where jsonb_typeof(item) is distinct from 'object'
  ) then
    raise exception 'Formato de líneas inválido';
  end if;

  select count(*), count(distinct line.product_id)
  into v_line_count, v_distinct_product_count
  from jsonb_to_recordset(p_lines) as line(
    product_id uuid,
    quantity numeric
  );

  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(
      product_id uuid,
      quantity numeric
    )
    where line.product_id is null
      or line.quantity is null
      or line.quantity <= 0
  ) then
    raise exception 'Producto y cantidad mayor a cero son obligatorios';
  end if;

  if v_line_count is distinct from v_distinct_product_count then
    raise exception 'No repitas el mismo producto en la solicitud';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(
      product_id uuid,
      quantity numeric
    )
    where not public.product_enabled_for_dept(
      line.product_id,
      p_department_id
    )
  ) then
    raise exception 'Uno o más productos no están habilitados para el departamento';
  end if;

  insert into public.supply_requests (
    department_id,
    requested_by,
    status,
    notes
  )
  values (
    p_department_id,
    auth.uid(),
    'pending',
    nullif(btrim(p_notes), '')
  )
  returning id into v_request_id;

  insert into public.supply_request_lines (
    request_id,
    product_id,
    quantity_requested
  )
  select
    v_request_id,
    line.product_id,
    line.quantity
  from jsonb_to_recordset(p_lines) as line(
    product_id uuid,
    quantity numeric
  );

  return v_request_id;
end;
$$;

create or replace function public.deliver_supply_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.supply_requests%rowtype;
  line record;
  qty numeric(12, 3);
  line_count integer := 0;
begin
  if not public.has_manage_catalog() then
    raise exception 'Sin permiso para entregar solicitudes';
  end if;

  select *
  into r
  from public.supply_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if r.status is distinct from 'approved' then
    raise exception 'Solo se pueden entregar solicitudes aprobadas';
  end if;

  for line in
    select *
    from public.supply_request_lines
    where request_id = p_request_id
    order by id
  loop
    line_count := line_count + 1;
    qty := coalesce(line.quantity_approved, line.quantity_requested);

    if qty is null or qty <= 0 then
      raise exception 'Cantidad inválida en línea de solicitud';
    end if;

    insert into public.stock_movements (
      product_id,
      movement_type,
      quantity,
      department_id,
      reason,
      responsible_user_id,
      source_type,
      source_id,
      notes
    )
    values (
      line.product_id,
      'out',
      qty,
      r.department_id,
      'Entrega solicitud #' || r.request_number::text,
      auth.uid(),
      'request',
      r.id,
      'supply_request_line:' || line.id::text
    );

    update public.supply_request_lines
    set quantity_approved = qty
    where id = line.id
      and quantity_approved is null;
  end loop;

  if line_count = 0 then
    raise exception 'La solicitud no contiene productos';
  end if;

  update public.supply_requests
  set status = 'delivered',
      delivered_by = auth.uid(),
      delivered_at = now(),
      reviewed_by = coalesce(reviewed_by, auth.uid()),
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
  where id = p_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RLS policies
-- ---------------------------------------------------------------------------
-- All reads require an active profile.
drop policy if exists departments_select_authenticated on public.departments;
create policy departments_select_authenticated
  on public.departments for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists product_categories_select_authenticated on public.product_categories;
create policy product_categories_select_authenticated
  on public.product_categories for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated
  on public.products for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists stock_movements_select_authenticated on public.stock_movements;
create policy stock_movements_select_authenticated
  on public.stock_movements for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists linen_items_select on public.linen_items;
create policy linen_items_select
  on public.linen_items for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists physical_counts_select on public.physical_counts;
create policy physical_counts_select
  on public.physical_counts for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists physical_count_lines_select on public.physical_count_lines;
create policy physical_count_lines_select
  on public.physical_count_lines for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists room_supply_params_select on public.room_supply_params;
create policy room_supply_params_select
  on public.room_supply_params for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists maid_allocations_select on public.maid_allocations;
create policy maid_allocations_select
  on public.maid_allocations for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists maid_allocation_rooms_select on public.maid_allocation_rooms;
create policy maid_allocation_rooms_select
  on public.maid_allocation_rooms for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists machines_select on public.machines;
create policy machines_select
  on public.machines for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists machine_tickets_select on public.machine_tickets;
create policy machine_tickets_select
  on public.machine_tickets for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists monthly_occupancy_select on public.monthly_occupancy;
create policy monthly_occupancy_select
  on public.monthly_occupancy for select
  to authenticated
  using ((select public.is_active_user()));

-- Profiles: no self-referential EXISTS; helpers bypass profiles RLS safely.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (
    (select public.is_active_user())
    and id = (select auth.uid())
  )
  with check (
    (select public.is_active_user())
    and id = (select auth.uid())
  );

drop policy if exists profiles_manage_admin on public.profiles;
create policy profiles_manage_admin
  on public.profiles for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Product-to-department assignments are readable by active users and managed
-- only by admin/mrla.
drop policy if exists product_departments_select on public.product_departments;
create policy product_departments_select
  on public.product_departments for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists product_departments_insert on public.product_departments;
create policy product_departments_insert
  on public.product_departments for insert
  to authenticated
  with check ((select public.has_manage_catalog()));

drop policy if exists product_departments_delete on public.product_departments;
create policy product_departments_delete
  on public.product_departments for delete
  to authenticated
  using ((select public.has_manage_catalog()));

-- Stock movements remain append-only. Department users are restricted to
-- their own department and products enabled for that department.
drop policy if exists stock_movements_insert_write on public.stock_movements;
drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert
  on public.stock_movements for insert
  to authenticated
  with check (
    (select public.is_active_user())
    and (
      (select public.current_app_role()) in ('admin', 'mrla')
      or (
        (select public.current_app_role()) = 'department_user'
        and department_id = (select public.current_department_id())
        and exists (
          select 1
          from public.product_departments pd
          where pd.product_id = stock_movements.product_id
            and pd.department_id = (select public.current_department_id())
        )
      )
    )
  );

-- Requests are visible globally to admin/mrla and only within the user's own
-- department for department_user. HR has no operational request scope.
drop policy if exists supply_requests_select on public.supply_requests;
create policy supply_requests_select
  on public.supply_requests for select
  to authenticated
  using (
    (select public.is_active_user())
    and (
      (select public.current_app_role()) in ('admin', 'mrla')
      or (
        (select public.current_app_role()) = 'department_user'
        and department_id = (select public.current_department_id())
      )
    )
  );

drop policy if exists supply_requests_insert on public.supply_requests;
create policy supply_requests_insert
  on public.supply_requests for insert
  to authenticated
  with check (
    (select public.is_active_user())
    and requested_by = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1
      from public.departments d
      where d.id = supply_requests.department_id
        and d.is_active = true
    )
    and (
      (select public.current_app_role()) in ('admin', 'mrla')
      or (
        (select public.current_app_role()) = 'department_user'
        and department_id = (select public.current_department_id())
      )
    )
  );

drop policy if exists supply_requests_update on public.supply_requests;
create policy supply_requests_update
  on public.supply_requests for update
  to authenticated
  using ((select public.has_manage_catalog()))
  with check (
    (select public.has_manage_catalog())
    and status in ('pending', 'approved', 'rejected')
  );

drop policy if exists supply_request_lines_select on public.supply_request_lines;
create policy supply_request_lines_select
  on public.supply_request_lines for select
  to authenticated
  using (
    (select public.is_active_user())
    and exists (
      select 1
      from public.supply_requests sr
      where sr.id = supply_request_lines.request_id
    )
  );

drop policy if exists supply_request_lines_write on public.supply_request_lines;
drop policy if exists supply_request_lines_insert on public.supply_request_lines;
create policy supply_request_lines_insert
  on public.supply_request_lines for insert
  to authenticated
  with check (
    (select public.is_active_user())
    and exists (
      select 1
      from public.supply_requests sr
      where sr.id = supply_request_lines.request_id
        and sr.status = 'pending'
        and public.product_enabled_for_dept(
          supply_request_lines.product_id,
          sr.department_id
        )
        and (
          (select public.current_app_role()) in ('admin', 'mrla')
          or (
            (select public.current_app_role()) = 'department_user'
            and sr.requested_by = (select auth.uid())
            and sr.department_id = (select public.current_department_id())
          )
        )
    )
  );

drop policy if exists supply_request_lines_update on public.supply_request_lines;
create policy supply_request_lines_update
  on public.supply_request_lines for update
  to authenticated
  using (
    (select public.has_manage_catalog())
    and exists (
      select 1
      from public.supply_requests sr
      where sr.id = supply_request_lines.request_id
        and sr.status in ('pending', 'approved')
    )
  )
  with check (
    (select public.has_manage_catalog())
    and exists (
      select 1
      from public.supply_requests sr
      where sr.id = supply_request_lines.request_id
        and sr.status in ('pending', 'approved')
    )
  );

-- Uniform governance belongs to admin and Human Resources.
drop policy if exists uniform_skus_select on public.uniform_skus;
create policy uniform_skus_select
  on public.uniform_skus for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists uniform_skus_write on public.uniform_skus;
create policy uniform_skus_write
  on public.uniform_skus for all
  to authenticated
  using ((select public.has_hr_scope()))
  with check ((select public.has_hr_scope()));

drop policy if exists uniform_assignments_select on public.uniform_assignments;
create policy uniform_assignments_select
  on public.uniform_assignments for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists uniform_assignments_insert on public.uniform_assignments;
create policy uniform_assignments_insert
  on public.uniform_assignments for insert
  to authenticated
  with check ((select public.has_hr_scope()));

drop policy if exists uniform_assignments_update on public.uniform_assignments;
create policy uniform_assignments_update
  on public.uniform_assignments for update
  to authenticated
  using ((select public.has_hr_scope()))
  with check ((select public.has_hr_scope()));

-- ---------------------------------------------------------------------------
-- 7. Least-privilege grants
-- ---------------------------------------------------------------------------
revoke all on table public.product_departments from public, anon;
revoke all on table public.product_departments from authenticated;
grant select, insert, delete on table public.product_departments to authenticated;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.current_department_id() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_mrla() from public, anon;
revoke all on function public.is_hr() from public, anon;
revoke all on function public.is_department_user() from public, anon;
revoke all on function public.has_manage_catalog() from public, anon;
revoke all on function public.has_write_ops() from public, anon;
revoke all on function public.has_hr_scope() from public, anon;
revoke all on function public.product_enabled_for_dept(uuid, uuid) from public, anon;
revoke all on function public.has_manage_role() from public, anon;
revoke all on function public.has_write_role() from public, anon;
revoke all on function public.assign_uniform(uuid, text, numeric, text) from public, anon;
revoke all on function public.return_uniform(uuid) from public, anon;
revoke all on function public.create_supply_request(uuid, text, jsonb) from public, anon;
revoke all on function public.deliver_supply_request(uuid) from public, anon;

grant execute on function public.is_active_user() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_department_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_mrla() to authenticated;
grant execute on function public.is_hr() to authenticated;
grant execute on function public.is_department_user() to authenticated;
grant execute on function public.has_manage_catalog() to authenticated;
grant execute on function public.has_write_ops() to authenticated;
grant execute on function public.has_hr_scope() to authenticated;
grant execute on function public.product_enabled_for_dept(uuid, uuid) to authenticated;
grant execute on function public.has_manage_role() to authenticated;
grant execute on function public.has_write_role() to authenticated;
grant execute on function public.assign_uniform(uuid, text, numeric, text) to authenticated;
grant execute on function public.return_uniform(uuid) to authenticated;
grant execute on function public.create_supply_request(uuid, text, jsonb) to authenticated;
grant execute on function public.deliver_supply_request(uuid) to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_profile_role_escalation()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Realtime publication for live product-stock alerts
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    execute 'alter publication supabase_realtime add table public.products';
  end if;
end;
$$;
