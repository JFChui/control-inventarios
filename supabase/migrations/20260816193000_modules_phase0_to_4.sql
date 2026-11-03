-- Phase 0–4: kardex source metadata + remaining inventory modules
-- ---------------------------------------------------------------------------
-- 0. Stock movement source tracking
-- ---------------------------------------------------------------------------
create type public.stock_movement_source as enum (
  'manual',
  'request',
  'maid_allocation',
  'physical_count',
  'linen'
);

alter table public.stock_movements
  add column if not exists source_type public.stock_movement_source not null default 'manual',
  add column if not exists source_id uuid;

create index if not exists stock_movements_source_idx
  on public.stock_movements (source_type, source_id);

-- ---------------------------------------------------------------------------
-- 1B. Supply requests
-- ---------------------------------------------------------------------------
create type public.supply_request_status as enum (
  'pending',
  'approved',
  'rejected',
  'delivered'
);

create table public.supply_requests (
  id uuid primary key default gen_random_uuid(),
  request_number serial,
  department_id uuid not null references public.departments (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  status public.supply_request_status not null default 'pending',
  notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  delivered_by uuid references public.profiles (id) on delete set null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index supply_requests_status_idx on public.supply_requests (status);
create index supply_requests_department_id_idx on public.supply_requests (department_id);

create table public.supply_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.supply_requests (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity_requested numeric(12, 3) not null check (quantity_requested > 0),
  quantity_approved numeric(12, 3) check (quantity_approved is null or quantity_approved > 0),
  created_at timestamptz not null default now(),
  unique (request_id, product_id)
);

create index supply_request_lines_request_id_idx on public.supply_request_lines (request_id);

create trigger supply_requests_set_updated_at
before update on public.supply_requests
for each row execute function public.set_updated_at();

-- Atomic deliver: approve quantities + stock outs + mark delivered (idempotent)
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
begin
  if not public.has_manage_role() then
    raise exception 'Sin permiso para entregar solicitudes';
  end if;

  select * into r from public.supply_requests where id = p_request_id for update;
  if not found then
    raise exception 'Solicitud no encontrada';
  end if;
  if r.status = 'delivered' then
    raise exception 'La solicitud ya fue entregada';
  end if;
  if r.status = 'rejected' then
    raise exception 'No se puede entregar una solicitud rechazada';
  end if;

  for line in
    select * from public.supply_request_lines where request_id = p_request_id
  loop
    qty := coalesce(line.quantity_approved, line.quantity_requested);
    if qty is null or qty <= 0 then
      raise exception 'Cantidad inválida en línea de solicitud';
    end if;

    insert into public.stock_movements (
      product_id, movement_type, quantity, department_id,
      reason, responsible_user_id, source_type, source_id, notes
    ) values (
      line.product_id, 'out', qty, r.department_id,
      'Entrega solicitud #' || r.request_number::text,
      auth.uid(), 'request', r.id,
      'supply_request_line:' || line.id::text
    );

    update public.supply_request_lines
    set quantity_approved = qty
    where id = line.id and quantity_approved is null;
  end loop;

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

revoke all on function public.deliver_supply_request(uuid) from public;
grant execute on function public.deliver_supply_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1C. Linen / blancos
-- ---------------------------------------------------------------------------
create table public.linen_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete restrict,
  available numeric(12, 3) not null default 0 check (available >= 0),
  in_use numeric(12, 3) not null default 0 check (in_use >= 0),
  in_laundry numeric(12, 3) not null default 0 check (in_laundry >= 0),
  damaged numeric(12, 3) not null default 0 check (damaged >= 0),
  written_off numeric(12, 3) not null default 0 check (written_off >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger linen_items_set_updated_at
before update on public.linen_items
for each row execute function public.set_updated_at();

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
  if not public.has_write_role() then
    raise exception 'Sin permiso para mover blancos';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;
  if p_from = p_to then
    raise exception 'Origen y destino iguales';
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
    when 'written_off' then item.written_off
    else null
  end;
  if from_val is null then
    raise exception 'Estado origen inválido: %', p_from;
  end if;
  if from_val < p_qty then
    raise exception 'Cantidad insuficiente en estado %', p_from;
  end if;

  -- decrement from
  if p_from = 'available' then
    update public.linen_items set available = available - p_qty where id = p_linen_id;
  elsif p_from = 'in_use' then
    update public.linen_items set in_use = in_use - p_qty where id = p_linen_id;
  elsif p_from = 'in_laundry' then
    update public.linen_items set in_laundry = in_laundry - p_qty where id = p_linen_id;
  elsif p_from = 'damaged' then
    update public.linen_items set damaged = damaged - p_qty where id = p_linen_id;
  elsif p_from = 'written_off' then
    update public.linen_items set written_off = written_off - p_qty where id = p_linen_id;
  end if;

  -- increment to
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
    -- irreversible write-off: stock out from product
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
end;
$$;

revoke all on function public.transition_linen(uuid, text, text, numeric) from public;
grant execute on function public.transition_linen(uuid, text, text, numeric) to authenticated;

-- Seed linen rows for products in Blancos category (if any)
insert into public.linen_items (product_id, available)
select p.id, p.quantity_on_hand
from public.products p
join public.product_categories c on c.id = p.category_id
where upper(c.code) in ('BLAN', 'BLANC', 'BLANCOS')
   or lower(c.name) like '%blanco%'
on conflict (product_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2A. Physical inventory
-- ---------------------------------------------------------------------------
create type public.physical_count_status as enum ('draft', 'posted');

create table public.physical_counts (
  id uuid primary key default gen_random_uuid(),
  counted_at date not null default current_date,
  status public.physical_count_status not null default 'draft',
  responsible_user_id uuid references public.profiles (id) on delete set null,
  notes text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.physical_count_lines (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.physical_counts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  system_qty numeric(12, 3) not null,
  counted_qty numeric(12, 3),
  difference numeric(12, 3) generated always as (coalesce(counted_qty, 0) - system_qty) stored,
  created_at timestamptz not null default now(),
  unique (count_id, product_id)
);

create index physical_count_lines_count_id_idx on public.physical_count_lines (count_id);

create trigger physical_counts_set_updated_at
before update on public.physical_counts
for each row execute function public.set_updated_at();

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
begin
  if not public.has_manage_role() then
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
    if diff > 0 then
      insert into public.stock_movements (
        product_id, movement_type, quantity, reason,
        responsible_user_id, source_type, source_id
      ) values (
        line.product_id, 'in', diff, 'Ajuste inventario físico',
        auth.uid(), 'physical_count', p_count_id
      );
    elsif diff < 0 then
      insert into public.stock_movements (
        product_id, movement_type, quantity, reason,
        responsible_user_id, source_type, source_id
      ) values (
        line.product_id, 'out', abs(diff), 'Ajuste inventario físico',
        auth.uid(), 'physical_count', p_count_id
      );
    end if;
  end loop;

  update public.physical_counts
  set status = 'posted', posted_at = now(), updated_at = now()
  where id = p_count_id;
end;
$$;

revoke all on function public.post_physical_count(uuid) from public;
grant execute on function public.post_physical_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3A. Uniforms
-- ---------------------------------------------------------------------------
create table public.uniform_skus (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  department_id uuid references public.departments (id) on delete set null,
  size text not null,
  total numeric(12, 3) not null check (total >= 0),
  available numeric(12, 3) not null check (available >= 0),
  in_use numeric(12, 3) not null default 0 check (in_use >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uniform_skus_balance check (total = available + in_use)
);

create table public.uniform_assignments (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.uniform_skus (id) on delete restrict,
  worker_name text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  assigned_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index uniform_assignments_sku_id_idx on public.uniform_assignments (sku_id);
create index uniform_assignments_open_idx on public.uniform_assignments (sku_id)
  where returned_at is null;

create trigger uniform_skus_set_updated_at
before update on public.uniform_skus
for each row execute function public.set_updated_at();

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
  if not public.has_write_role() then
    raise exception 'Sin permiso para asignar uniformes';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;

  select * into sku from public.uniform_skus where id = p_sku_id for update;
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

  insert into public.uniform_assignments (sku_id, worker_name, quantity, assigned_by, notes)
  values (p_sku_id, trim(p_worker_name), p_qty, auth.uid(), p_notes)
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
  if not public.has_write_role() then
    raise exception 'Sin permiso para devolver uniformes';
  end if;

  select * into a from public.uniform_assignments where id = p_assignment_id for update;
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

revoke all on function public.assign_uniform(uuid, text, numeric, text) from public;
revoke all on function public.return_uniform(uuid) from public;
grant execute on function public.assign_uniform(uuid, text, numeric, text) to authenticated;
grant execute on function public.return_uniform(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3B. Maid / room supply allocation
-- ---------------------------------------------------------------------------
create type public.room_service_type as enum ('ocupacion', 'salida', 'limpieza');

create table public.room_supply_params (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  room_type text not null default 'standard',
  service_type public.room_service_type not null default 'ocupacion',
  qty_per_room numeric(12, 3) not null check (qty_per_room >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, room_type, service_type)
);

create table public.maid_allocations (
  id uuid primary key default gen_random_uuid(),
  maid_name text not null,
  shift text,
  allocation_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  created_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maid_allocation_rooms (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.maid_allocations (id) on delete cascade,
  room_number text not null,
  room_type text not null default 'standard',
  service_type public.room_service_type not null default 'ocupacion',
  unique (allocation_id, room_number)
);

create trigger maid_allocations_set_updated_at
before update on public.maid_allocations
for each row execute function public.set_updated_at();

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
begin
  if not public.has_write_role() then
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

  update public.maid_allocations
  set status = 'confirmed', confirmed_at = now(), updated_at = now()
  where id = p_allocation_id;
end;
$$;

revoke all on function public.confirm_maid_allocation(uuid) from public;
grant execute on function public.confirm_maid_allocation(uuid) to authenticated;

-- Seed default room params from amenity/blanco products if params empty
insert into public.room_supply_params (product_id, room_type, service_type, qty_per_room)
select p.id, 'standard', 'ocupacion',
  case when lower(p.name) like '%papel%' then 2 else 1 end
from public.products p
join public.product_categories c on c.id = p.category_id
where lower(c.name) like '%amenidad%'
   or upper(c.code) like 'AMEN%'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4A. Machinery
-- ---------------------------------------------------------------------------
create type public.machine_ticket_status as enum (
  'reportada',
  'entregada',
  'en_reparacion',
  'reparada',
  'fuera_de_servicio'
);

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.machine_tickets (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete restrict,
  reported_at timestamptz not null default now(),
  reported_by uuid references public.profiles (id) on delete set null,
  problem_description text not null,
  maintenance_assignee text,
  status public.machine_ticket_status not null default 'reportada',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index machine_tickets_status_idx on public.machine_tickets (status);
create index machine_tickets_machine_id_idx on public.machine_tickets (machine_id);

create trigger machine_tickets_set_updated_at
before update on public.machine_tickets
for each row execute function public.set_updated_at();

insert into public.machines (code, name, location)
values
  ('LAV-01', 'Lavadora industrial #01', 'Lavandería'),
  ('LAV-02', 'Lavadora industrial #02', 'Lavandería'),
  ('SEC-01', 'Secadora industrial #01', 'Lavandería')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 4B. Monthly occupancy
-- ---------------------------------------------------------------------------
create table public.monthly_occupancy (
  year_month date primary key,
  occupancy_pct numeric(5, 2) not null check (occupancy_pct >= 0 and occupancy_pct <= 100),
  rooms_sold integer check (rooms_sold is null or rooms_sold >= 0),
  notes text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint monthly_occupancy_first_of_month check (extract(day from year_month) = 1)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.supply_requests enable row level security;
alter table public.supply_request_lines enable row level security;
alter table public.linen_items enable row level security;
alter table public.physical_counts enable row level security;
alter table public.physical_count_lines enable row level security;
alter table public.uniform_skus enable row level security;
alter table public.uniform_assignments enable row level security;
alter table public.room_supply_params enable row level security;
alter table public.maid_allocations enable row level security;
alter table public.maid_allocation_rooms enable row level security;
alter table public.machines enable row level security;
alter table public.machine_tickets enable row level security;
alter table public.monthly_occupancy enable row level security;

-- supply_requests
create policy supply_requests_select on public.supply_requests for select to authenticated using (true);
create policy supply_requests_insert on public.supply_requests for insert to authenticated
  with check ((select public.has_write_role()));
create policy supply_requests_update on public.supply_requests for update to authenticated
  using ((select public.has_manage_role()) or requested_by = auth.uid())
  with check ((select public.has_manage_role()) or requested_by = auth.uid());

create policy supply_request_lines_select on public.supply_request_lines for select to authenticated using (true);
create policy supply_request_lines_write on public.supply_request_lines for all to authenticated
  using ((select public.has_write_role()))
  with check ((select public.has_write_role()));

-- linen
create policy linen_items_select on public.linen_items for select to authenticated using (true);
create policy linen_items_write on public.linen_items for all to authenticated
  using ((select public.has_manage_role()))
  with check ((select public.has_manage_role()));

-- physical
create policy physical_counts_select on public.physical_counts for select to authenticated using (true);
create policy physical_counts_write on public.physical_counts for all to authenticated
  using ((select public.has_write_role()))
  with check ((select public.has_write_role()));
create policy physical_count_lines_select on public.physical_count_lines for select to authenticated using (true);
create policy physical_count_lines_write on public.physical_count_lines for all to authenticated
  using ((select public.has_write_role()))
  with check ((select public.has_write_role()));

-- uniforms
create policy uniform_skus_select on public.uniform_skus for select to authenticated using (true);
create policy uniform_skus_write on public.uniform_skus for all to authenticated
  using ((select public.has_manage_role()))
  with check ((select public.has_manage_role()));
create policy uniform_assignments_select on public.uniform_assignments for select to authenticated using (true);
create policy uniform_assignments_insert on public.uniform_assignments for insert to authenticated
  with check ((select public.has_write_role()));
create policy uniform_assignments_update on public.uniform_assignments for update to authenticated
  using ((select public.has_write_role()))
  with check ((select public.has_write_role()));

-- room params / maid
create policy room_supply_params_select on public.room_supply_params for select to authenticated using (true);
create policy room_supply_params_write on public.room_supply_params for all to authenticated
  using ((select public.has_manage_role()))
  with check ((select public.has_manage_role()));
create policy maid_allocations_select on public.maid_allocations for select to authenticated using (true);
create policy maid_allocations_write on public.maid_allocations for all to authenticated
  using ((select public.has_write_role()))
  with check ((select public.has_write_role()));
create policy maid_allocation_rooms_select on public.maid_allocation_rooms for select to authenticated using (true);
create policy maid_allocation_rooms_write on public.maid_allocation_rooms for all to authenticated
  using ((select public.has_write_role()))
  with check ((select public.has_write_role()));

-- machines
create policy machines_select on public.machines for select to authenticated using (true);
create policy machines_write on public.machines for all to authenticated
  using ((select public.has_manage_role()))
  with check ((select public.has_manage_role()));
create policy machine_tickets_select on public.machine_tickets for select to authenticated using (true);
create policy machine_tickets_insert on public.machine_tickets for insert to authenticated
  with check ((select public.has_write_role()));
create policy machine_tickets_update on public.machine_tickets for update to authenticated
  using ((select public.has_write_role()))
  with check ((select public.has_write_role()));

-- occupancy
create policy monthly_occupancy_select on public.monthly_occupancy for select to authenticated using (true);
create policy monthly_occupancy_write on public.monthly_occupancy for all to authenticated
  using ((select public.has_manage_role()))
  with check ((select public.has_manage_role()));
