-- Linners (pisos 6-26 sin 13 + recepción), par vs real, and pieces_per_room for vueltas.
create type public.storage_location_kind as enum ('floor_linner', 'reception_linner');

create table public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind public.storage_location_kind not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.storage_locations (code, name, kind, sort_order)
select
  'L' || lpad(n::text, 2, '0'),
  'Linner piso ' || n::text,
  'floor_linner'::public.storage_location_kind,
  n
from generate_series(6, 26) as n
where n <> 13
union all
select 'REC', 'Linner de Recepción', 'reception_linner'::public.storage_location_kind, 0;

alter table public.storage_locations enable row level security;

create policy storage_locations_select
  on public.storage_locations for select to authenticated
  using ((select public.is_active_user()));

revoke all on table public.storage_locations from public, anon;
grant select on table public.storage_locations to authenticated;

alter table public.linen_items
  add column if not exists pieces_per_room numeric(12, 3) not null default 0
    check (pieces_per_room >= 0);

create table public.linen_location_stock (
  id uuid primary key default gen_random_uuid(),
  linen_item_id uuid not null references public.linen_items (id) on delete cascade,
  location_id uuid not null references public.storage_locations (id) on delete restrict,
  quantity numeric(12, 3) not null default 0 check (quantity >= 0),
  par_qty numeric(12, 3) not null default 0 check (par_qty >= 0),
  updated_at timestamptz not null default now(),
  unique (linen_item_id, location_id)
);

create index linen_location_stock_location_id_idx
  on public.linen_location_stock (location_id);

alter table public.linen_location_stock enable row level security;

create policy linen_location_stock_select
  on public.linen_location_stock for select to authenticated
  using (
    (select public.can_access_module('blancos'))
    or (select public.can_access_module('reportes'))
  );

revoke all on table public.linen_location_stock from public, anon;
grant select on table public.linen_location_stock to authenticated;

update public.hotel_settings set total_rooms = 212, updated_at = now() where id = 1;

create or replace function public.assert_linen_locations_fit(p_linen_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_available numeric;
  v_located numeric;
begin
  select available into v_available from public.linen_items where id = p_linen_id;
  select coalesce(sum(quantity), 0) into v_located
  from public.linen_location_stock where linen_item_id = p_linen_id;
  if v_located > coalesce(v_available, 0) then
    raise exception 'Hay más lencería en linners (%) que disponible (%)',
      v_located, v_available;
  end if;
end;
$$;

revoke all on function public.assert_linen_locations_fit(uuid) from public, anon, authenticated;

create or replace function public.set_linen_pieces_per_room(
  p_linen_id uuid,
  p_qty numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_module('blancos') then
    raise exception 'Sin permiso para configurar blancos';
  end if;
  if p_qty is null or p_qty < 0 then
    raise exception 'Piezas por habitación inválidas';
  end if;
  update public.linen_items
  set pieces_per_room = p_qty, updated_at = now()
  where id = p_linen_id;
  if not found then
    raise exception 'Blanco no encontrado';
  end if;
end;
$$;

revoke all on function public.set_linen_pieces_per_room(uuid, numeric) from public, anon;
grant execute on function public.set_linen_pieces_per_room(uuid, numeric) to authenticated;

create or replace function public.set_linner_par(
  p_linen_id uuid,
  p_location_id uuid,
  p_par numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_module('blancos') then
    raise exception 'Sin permiso para configurar linners';
  end if;
  if p_par is null or p_par < 0 then
    raise exception 'Par inválido';
  end if;
  if not exists (select 1 from public.linen_items where id = p_linen_id) then
    raise exception 'Blanco no encontrado';
  end if;
  if not exists (select 1 from public.storage_locations where id = p_location_id and is_active) then
    raise exception 'Linner no encontrado';
  end if;

  insert into public.linen_location_stock (linen_item_id, location_id, quantity, par_qty)
  values (p_linen_id, p_location_id, 0, p_par)
  on conflict (linen_item_id, location_id)
  do update set par_qty = excluded.par_qty, updated_at = now();
end;
$$;

revoke all on function public.set_linner_par(uuid, uuid, numeric) from public, anon;
grant execute on function public.set_linner_par(uuid, uuid, numeric) to authenticated;

create or replace function public.stock_linner(
  p_linen_id uuid,
  p_location_id uuid,
  p_qty numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.linen_items%rowtype;
  v_located numeric;
  v_unlocated numeric;
begin
  if not public.can_access_module('blancos') then
    raise exception 'Sin permiso para surtir linners';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;
  if not exists (
    select 1 from public.storage_locations where id = p_location_id and is_active
  ) then
    raise exception 'Linner no encontrado';
  end if;

  select * into item from public.linen_items where id = p_linen_id for update;
  if not found then
    raise exception 'Blanco no encontrado';
  end if;

  select coalesce(sum(quantity), 0) into v_located
  from public.linen_location_stock where linen_item_id = p_linen_id;
  v_unlocated := item.available - v_located;
  if v_unlocated < p_qty then
    raise exception 'No hay suficiente lencería en almacén de lavandería (sin ubicar)';
  end if;

  insert into public.linen_location_stock (linen_item_id, location_id, quantity, par_qty)
  values (p_linen_id, p_location_id, p_qty, 0)
  on conflict (linen_item_id, location_id)
  do update set
    quantity = public.linen_location_stock.quantity + excluded.quantity,
    updated_at = now();
end;
$$;

revoke all on function public.stock_linner(uuid, uuid, numeric) from public, anon;
grant execute on function public.stock_linner(uuid, uuid, numeric) to authenticated;

create or replace function public.return_from_linner(
  p_linen_id uuid,
  p_location_id uuid,
  p_qty numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  loc public.linen_location_stock%rowtype;
begin
  if not public.can_access_module('blancos') then
    raise exception 'Sin permiso para mover linners';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;

  perform 1 from public.linen_items where id = p_linen_id for update;

  select * into loc
  from public.linen_location_stock
  where linen_item_id = p_linen_id and location_id = p_location_id
  for update;
  if not found or loc.quantity < p_qty then
    raise exception 'Cantidad insuficiente en ese linner';
  end if;

  update public.linen_location_stock
  set quantity = quantity - p_qty, updated_at = now()
  where id = loc.id;
end;
$$;

revoke all on function public.return_from_linner(uuid, uuid, numeric) from public, anon;
grant execute on function public.return_from_linner(uuid, uuid, numeric) to authenticated;

drop function if exists public.transition_linen(uuid, text, text, numeric);

create function public.transition_linen(
  p_linen_id uuid,
  p_from text,
  p_to text,
  p_qty numeric,
  p_location_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.linen_items%rowtype;
  from_val numeric;
  v_located numeric;
  v_unlocated numeric;
  loc public.linen_location_stock%rowtype;
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
    select coalesce(sum(quantity), 0) into v_located
    from public.linen_location_stock where linen_item_id = p_linen_id;
    v_unlocated := item.available - v_located;

    if p_location_id is not null then
      select * into loc
      from public.linen_location_stock
      where linen_item_id = p_linen_id and location_id = p_location_id
      for update;
      if not found or loc.quantity < p_qty then
        raise exception 'Cantidad insuficiente en ese linner';
      end if;
      update public.linen_location_stock
      set quantity = quantity - p_qty, updated_at = now()
      where id = loc.id;
    elsif v_unlocated < p_qty then
      raise exception 'Indique el linner de origen; no hay suficiente en almacén de lavandería';
    end if;
  elsif p_location_id is not null then
    raise exception 'El linner solo aplica al sacar de disponible';
  end if;

  if p_from = 'available' then
    update public.linen_items set available = available - p_qty, updated_at = now() where id = p_linen_id;
  elsif p_from = 'in_use' then
    update public.linen_items set in_use = in_use - p_qty, updated_at = now() where id = p_linen_id;
  elsif p_from = 'in_laundry' then
    update public.linen_items set in_laundry = in_laundry - p_qty, updated_at = now() where id = p_linen_id;
  elsif p_from = 'damaged' then
    update public.linen_items set damaged = damaged - p_qty, updated_at = now() where id = p_linen_id;
  end if;

  if p_to = 'available' then
    update public.linen_items set available = available + p_qty, updated_at = now() where id = p_linen_id;
  elsif p_to = 'in_use' then
    update public.linen_items set in_use = in_use + p_qty, updated_at = now() where id = p_linen_id;
  elsif p_to = 'in_laundry' then
    update public.linen_items set in_laundry = in_laundry + p_qty, updated_at = now() where id = p_linen_id;
  elsif p_to = 'damaged' then
    update public.linen_items set damaged = damaged + p_qty, updated_at = now() where id = p_linen_id;
  elsif p_to = 'written_off' then
    update public.linen_items set written_off = written_off + p_qty, updated_at = now() where id = p_linen_id;
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

  perform public.assert_linen_locations_fit(p_linen_id);
  perform public.assert_linen_matches_product(item.product_id);
end;
$$;

revoke all on function public.transition_linen(uuid, text, text, numeric, uuid) from public, anon;
grant execute on function public.transition_linen(uuid, text, text, numeric, uuid) to authenticated;
