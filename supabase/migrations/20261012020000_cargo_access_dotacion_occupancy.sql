-- Cargo access matrix, maid counts, occupancy daily/monthly, drop machines.location.

-- ---------------------------------------------------------------------------
-- 1. Remap existing users onto cargo roles
-- ---------------------------------------------------------------------------
update public.profiles
set role = case role::text
  when 'admin' then 'senior_design_manager'::public.app_role
  when 'human_resources' then 'hr_manager'::public.app_role
  when 'department_user' then 'floor_supervisor_a'::public.app_role
  else role
end
where role::text in ('admin', 'human_resources', 'department_user');

alter table public.profiles
  alter column role set default 'floor_supervisor_a'::public.app_role;

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
    'floor_supervisor_a'
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Access-matrix helper
-- ---------------------------------------------------------------------------
create or replace function public.can_access_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
    and p_module is not null
    and (
      case public.current_app_role()
        when 'senior_design_manager' then true
        when 'design_manager' then true
        when 'admin' then true
        when 'hr_manager' then p_module in ('dashboard', 'uniformes')
        when 'human_resources' then p_module in ('dashboard', 'uniformes')
        when 'laundry_supervisor' then p_module in (
          'dashboard', 'blancos', 'uniformes', 'maquinaria'
        )
        when 'floor_supervisor_a' then p_module in (
          'dashboard', 'inventario', 'inventario_fisico',
          'reportes', 'alertas', 'dotacion'
        )
        when 'floor_supervisor_b' then p_module in (
          'dashboard', 'inventario', 'inventario_fisico',
          'reportes', 'alertas', 'dotacion'
        )
        when 'floor_supervisor_c' then p_module in (
          'dashboard', 'inventario', 'inventario_fisico',
          'reportes', 'alertas', 'dotacion'
        )
        when 'department_user' then p_module in (
          'dashboard', 'inventario', 'inventario_fisico',
          'reportes', 'alertas', 'dotacion'
        )
        when 'mrla' then p_module in (
          'dashboard', 'inventario', 'inventario_fisico',
          'reportes', 'alertas', 'dotacion'
        )
        else false
      end
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in (
    'admin', 'senior_design_manager', 'design_manager'
  );
$$;

create or replace function public.is_hr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('human_resources', 'hr_manager');
$$;

create or replace function public.is_department_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in (
    'department_user',
    'floor_supervisor_a',
    'floor_supervisor_b',
    'floor_supervisor_c'
  );
$$;

create or replace function public.has_manage_catalog()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in (
    'admin', 'senior_design_manager', 'design_manager'
  );
$$;

create or replace function public.has_write_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_module('movimientos');
$$;

create or replace function public.has_hr_scope()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_module('uniformes');
$$;

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
  select public.is_active_user()
    and public.current_app_role() in (
      'admin',
      'senior_design_manager',
      'design_manager',
      'mrla',
      'hr_manager',
      'human_resources',
      'laundry_supervisor',
      'floor_supervisor_a',
      'floor_supervisor_b',
      'floor_supervisor_c',
      'department_user'
    );
$$;

revoke all on function public.can_access_module(text) from public, anon;
grant execute on function public.can_access_module(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Write policies per module
-- ---------------------------------------------------------------------------
drop policy if exists stock_movements_select_authenticated on public.stock_movements;
create policy stock_movements_select_authenticated
  on public.stock_movements for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert
  on public.stock_movements for insert
  to authenticated
  with check ((select public.can_access_module('movimientos')));

drop policy if exists product_departments_select on public.product_departments;
create policy product_departments_select
  on public.product_departments for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists linen_items_write on public.linen_items;
create policy linen_items_write on public.linen_items for all to authenticated
  using ((select public.can_access_module('blancos')))
  with check ((select public.can_access_module('blancos')));

drop policy if exists physical_counts_write on public.physical_counts;
create policy physical_counts_write on public.physical_counts for all to authenticated
  using ((select public.can_access_module('inventario_fisico')))
  with check ((select public.can_access_module('inventario_fisico')));

drop policy if exists physical_count_lines_write on public.physical_count_lines;
create policy physical_count_lines_write on public.physical_count_lines for all to authenticated
  using ((select public.can_access_module('inventario_fisico')))
  with check ((select public.can_access_module('inventario_fisico')));

drop policy if exists room_supply_params_write on public.room_supply_params;
create policy room_supply_params_write on public.room_supply_params for all to authenticated
  using ((select public.has_manage_catalog()))
  with check ((select public.has_manage_catalog()));

drop policy if exists maid_allocations_write on public.maid_allocations;
create policy maid_allocations_write on public.maid_allocations for all to authenticated
  using ((select public.can_access_module('dotacion')))
  with check ((select public.can_access_module('dotacion')));

drop policy if exists maid_allocation_rooms_write on public.maid_allocation_rooms;
create policy maid_allocation_rooms_write on public.maid_allocation_rooms for all to authenticated
  using ((select public.can_access_module('dotacion')))
  with check ((select public.can_access_module('dotacion')));

drop policy if exists machines_write on public.machines;
create policy machines_write on public.machines for all to authenticated
  using ((select public.can_access_module('maquinaria')))
  with check ((select public.can_access_module('maquinaria')));

drop policy if exists machine_tickets_insert on public.machine_tickets;
create policy machine_tickets_insert on public.machine_tickets for insert to authenticated
  with check ((select public.can_access_module('maquinaria')));

drop policy if exists machine_tickets_update on public.machine_tickets;
create policy machine_tickets_update on public.machine_tickets for update to authenticated
  using ((select public.can_access_module('maquinaria')))
  with check ((select public.can_access_module('maquinaria')));

drop policy if exists monthly_occupancy_write on public.monthly_occupancy;
create policy monthly_occupancy_write on public.monthly_occupancy for all to authenticated
  using ((select public.can_access_module('estadisticas')))
  with check ((select public.can_access_module('estadisticas')));

-- ---------------------------------------------------------------------------
-- 4. RPC permission checks
-- ---------------------------------------------------------------------------
create or replace function public.transition_linen(
  p_linen_id uuid,
  p_from text,
  p_to text,
  p_qty numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.linen_items%rowtype;
  from_val numeric;
begin
  if not public.can_access_module('blancos') then
    raise exception 'Sin permiso para mover blancos';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;
  if p_from = p_to then
    raise exception 'Origen y destino iguales';
  end if;
  if p_from = 'written_off' then
    raise exception 'La baja es definitiva y no vuelve a existencia';
  end if;

  select * into item from public.linen_items where id = p_linen_id for update;
  if not found then
    raise exception 'Blanco no encontrado';
  end if;

  from_val := case p_from
    when 'available' then item.available
    when 'in_use' then item.in_use
    when 'in_laundry' then item.in_laundry
    when 'damaged' then item.damaged
    else null
  end;
  if from_val is null then
    raise exception 'Estado origen inválido: %', p_from;
  end if;
  if from_val < p_qty then
    raise exception 'Cantidad insuficiente en estado %', p_from;
  end if;

  if p_from = 'available' then
    update public.linen_items set available = available - p_qty where id = p_linen_id;
  elsif p_from = 'in_use' then
    update public.linen_items set in_use = in_use - p_qty where id = p_linen_id;
  elsif p_from = 'in_laundry' then
    update public.linen_items set in_laundry = in_laundry - p_qty where id = p_linen_id;
  elsif p_from = 'damaged' then
    update public.linen_items set damaged = damaged - p_qty where id = p_linen_id;
  end if;

  if p_to = 'available' then
    update public.linen_items set available = available + p_qty where id = p_linen_id;
  elsif p_to = 'in_use' then
    update public.linen_items set in_use = in_use + p_qty where id = p_linen_id;
  elsif p_to = 'in_laundry' then
    update public.linen_items set in_laundry = in_laundry + p_qty where id = p_linen_id;
  elsif p_to = 'damaged' then
    update public.linen_items set damaged = damaged + p_qty where id = p_linen_id;
  elsif p_to = 'written_off' then
    update public.linen_items set written_off = written_off + p_qty where id = p_linen_id;
    insert into public.stock_movements (
      product_id, movement_type, quantity, reason,
      responsible_user_id, source_type, source_id
    ) values (
      item.product_id, 'out', p_qty, 'Baja de blanco',
      auth.uid(), 'linen', p_linen_id
    );
  else
    raise exception 'Estado destino inválido: %', p_to;
  end if;

  perform public.assert_linen_matches_product(item.product_id);
end;
$$;

create or replace function public.post_physical_count(p_count_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.physical_counts%rowtype;
  line record;
  diff numeric(12, 3);
  v_reason text;
  v_qoh numeric(12, 3);
  v_committed numeric(12, 3);
  v_linen public.linen_items%rowtype;
begin
  if not public.can_access_module('inventario_fisico') then
    raise exception 'Sin permiso para cerrar inventario físico';
  end if;

  select * into c from public.physical_counts where id = p_count_id for update;
  if not found then
    raise exception 'Conteo no encontrado';
  end if;
  if c.status = 'posted' then
    raise exception 'El conteo ya está cerrado';
  end if;

  for line in
    select * from public.physical_count_lines
    where count_id = p_count_id and counted_qty is not null
  loop
    diff := line.counted_qty - line.system_qty;
    v_reason := case
      when line.system_qty = 0 then 'Apertura inventario físico'
      else 'Ajuste inventario físico'
    end;

    if diff > 0 then
      insert into public.stock_movements (
        product_id, movement_type, quantity, reason,
        responsible_user_id, source_type, source_id
      ) values (
        line.product_id, 'in', diff, v_reason,
        auth.uid(), 'physical_count', p_count_id
      );
    elsif diff < 0 then
      insert into public.stock_movements (
        product_id, movement_type, quantity, reason,
        responsible_user_id, source_type, source_id
      ) values (
        line.product_id, 'out', abs(diff), v_reason,
        auth.uid(), 'physical_count', p_count_id
      );
    end if;

    update public.products
    set inventory_initialized_at = coalesce(inventory_initialized_at, now()),
        updated_at = now()
    where id = line.product_id;

    select * into v_linen
    from public.linen_items
    where product_id = line.product_id
    for update;

    if found then
      select quantity_on_hand into v_qoh
      from public.products
      where id = line.product_id;

      if line.system_qty = 0 then
        update public.linen_items
        set available = v_qoh,
            in_use = 0,
            in_laundry = 0,
            damaged = 0
        where product_id = line.product_id;
      else
        v_committed := v_linen.in_use + v_linen.in_laundry + v_linen.damaged;
        if v_qoh < v_committed then
          raise exception
            'El conteo del blanco deja existencia (%) por debajo de piezas en uso/lavandería/dañado (%)',
            v_qoh, v_committed;
        end if;
        update public.linen_items
        set available = v_qoh - (in_use + in_laundry + damaged)
        where product_id = line.product_id;
      end if;
    end if;
  end loop;

  update public.physical_counts
  set status = 'posted', posted_at = now(), updated_at = now()
  where id = p_count_id;
end;
$$;

-- Maid counts must exist before confirm_maid_allocation references them.
create table public.maid_allocation_counts (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.maid_allocations (id) on delete cascade,
  room_type text not null,
  service_type public.room_service_type not null,
  room_count integer not null check (room_count > 0),
  unique (allocation_id, room_type, service_type)
);

create index maid_allocation_counts_allocation_id_idx
  on public.maid_allocation_counts (allocation_id);

alter table public.maid_allocation_counts enable row level security;

create policy maid_allocation_counts_select
  on public.maid_allocation_counts for select to authenticated
  using ((select public.is_active_user()));

create policy maid_allocation_counts_write
  on public.maid_allocation_counts for all to authenticated
  using ((select public.can_access_module('dotacion')))
  with check ((select public.can_access_module('dotacion')));

revoke all on table public.maid_allocation_counts from public, anon;
grant select, insert, update, delete on table public.maid_allocation_counts to authenticated;

create or replace function public.confirm_maid_allocation(p_allocation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.maid_allocations%rowtype;
  need record;
  ama_dept uuid;
  has_counts boolean;
begin
  if not public.can_access_module('dotacion') then
    raise exception 'Sin permiso para confirmar dotación';
  end if;

  select * into a from public.maid_allocations where id = p_allocation_id for update;
  if not found then
    raise exception 'Dotación no encontrada';
  end if;
  if a.status = 'confirmed' then
    raise exception 'La dotación ya fue confirmada';
  end if;

  select id into ama_dept from public.departments where code = 'AMA' limit 1;

  select exists (
    select 1 from public.maid_allocation_counts where allocation_id = p_allocation_id
  ) into has_counts;

  if has_counts then
    for need in
      select p.product_id, sum(c.room_count * p.qty_per_room) as total_qty
      from public.maid_allocation_counts c
      join public.room_supply_params p
        on p.room_type = c.room_type
       and p.service_type = c.service_type
      where c.allocation_id = p_allocation_id
      group by p.product_id
      having sum(c.room_count * p.qty_per_room) > 0
    loop
      insert into public.stock_movements (
        product_id, movement_type, quantity, department_id,
        reason, responsible_user_id, source_type, source_id, notes
      ) values (
        need.product_id, 'out', need.total_qty, ama_dept,
        'Dotación camarera ' || a.maid_name,
        auth.uid(), 'maid_allocation', p_allocation_id,
        'Fecha ' || a.allocation_date::text
      );
    end loop;
  else
    for need in
      select p.product_id, sum(p.qty_per_room) as total_qty
      from public.maid_allocation_rooms r
      join public.room_supply_params p
        on p.room_type = r.room_type
       and p.service_type = r.service_type
      where r.allocation_id = p_allocation_id
      group by p.product_id
      having sum(p.qty_per_room) > 0
    loop
      insert into public.stock_movements (
        product_id, movement_type, quantity, department_id,
        reason, responsible_user_id, source_type, source_id, notes
      ) values (
        need.product_id, 'out', need.total_qty, ama_dept,
        'Dotación camarera ' || a.maid_name,
        auth.uid(), 'maid_allocation', p_allocation_id,
        'Fecha ' || a.allocation_date::text
      );
    end loop;
  end if;

  update public.maid_allocations
  set status = 'confirmed', confirmed_at = now(), updated_at = now()
  where id = p_allocation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Occupancy: hotel settings + daily rows + monthly view
-- ---------------------------------------------------------------------------
create table public.hotel_settings (
  id smallint primary key default 1 check (id = 1),
  total_rooms integer not null check (total_rooms > 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.hotel_settings (id, total_rooms) values (1, 100);

alter table public.hotel_settings enable row level security;

create policy hotel_settings_select
  on public.hotel_settings for select to authenticated
  using ((select public.is_active_user()));

create policy hotel_settings_write
  on public.hotel_settings for all to authenticated
  using ((select public.can_access_module('estadisticas')))
  with check ((select public.can_access_module('estadisticas')));

revoke all on table public.hotel_settings from public, anon;
grant select, insert, update, delete on table public.hotel_settings to authenticated;

create table public.daily_occupancy (
  occupancy_date date primary key,
  occupied_dirty integer not null check (occupied_dirty >= 0),
  occupied_clean integer not null check (occupied_clean >= 0),
  total_rooms integer not null check (total_rooms > 0),
  occupancy_pct numeric(5, 2) generated always as (
    round(((occupied_dirty + occupied_clean)::numeric / total_rooms) * 100, 2)
  ) stored,
  notes text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint daily_occupancy_rooms_fit
    check (occupied_dirty + occupied_clean <= total_rooms)
);

alter table public.daily_occupancy enable row level security;

create policy daily_occupancy_select
  on public.daily_occupancy for select to authenticated
  using ((select public.is_active_user()));

create policy daily_occupancy_write
  on public.daily_occupancy for all to authenticated
  using ((select public.can_access_module('estadisticas')))
  with check ((select public.can_access_module('estadisticas')));

revoke all on table public.daily_occupancy from public, anon;
grant select, insert, update, delete on table public.daily_occupancy to authenticated;

create view public.v_monthly_occupancy
with (security_invoker = true)
as
select
  date_trunc('month', occupancy_date)::date as year_month,
  round(avg(occupancy_pct), 2) as occupancy_pct,
  count(*)::integer as days_recorded,
  sum(occupied_dirty + occupied_clean)::integer as occupied_sum
from public.daily_occupancy
group by 1;

grant select on public.v_monthly_occupancy to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Maquinaria: drop location
-- ---------------------------------------------------------------------------
alter table public.machines drop column if exists location;

-- CREATE OR REPLACE resets EXECUTE to PUBLIC; lock it down again.
revoke all on function public.confirm_maid_allocation(uuid) from public, anon;
grant execute on function public.confirm_maid_allocation(uuid) to authenticated;
revoke all on function public.transition_linen(uuid, text, text, numeric) from public, anon;
grant execute on function public.transition_linen(uuid, text, text, numeric) to authenticated;
revoke all on function public.post_physical_count(uuid) from public, anon;
grant execute on function public.post_physical_count(uuid) to authenticated;
revoke all on function public.handle_new_user() from public, anon;

create index if not exists daily_occupancy_updated_by_idx
  on public.daily_occupancy (updated_by);
create index if not exists hotel_settings_updated_by_idx
  on public.hotel_settings (updated_by);
