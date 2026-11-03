-- Module linner_recepcion, reception stock table, and send/consume RPCs.
-- Depends on stock_movement_source value 'reception_linner' (previous migration).
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
          'reportes', 'alertas', 'dotacion', 'linner_recepcion'
        )
        when 'floor_supervisor_b' then p_module in (
          'dashboard', 'inventario', 'inventario_fisico',
          'reportes', 'alertas', 'dotacion', 'linner_recepcion'
        )
        when 'floor_supervisor_c' then p_module in (
          'dashboard', 'inventario', 'inventario_fisico',
          'reportes', 'alertas', 'dotacion', 'linner_recepcion'
        )
        when 'department_user' then p_module in (
          'dashboard', 'inventario', 'inventario_fisico',
          'reportes', 'alertas', 'dotacion', 'linner_recepcion'
        )
        when 'mrla' then p_module in (
          'dashboard', 'inventario', 'inventario_fisico',
          'reportes', 'alertas', 'dotacion', 'linner_recepcion'
        )
        else false
      end
    );
$$;

revoke all on function public.can_access_module(text) from public, anon;
grant execute on function public.can_access_module(text) to authenticated;

create table public.reception_linner_stock (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete restrict,
  quantity numeric(12, 3) not null default 0 check (quantity >= 0),
  min_qty numeric(12, 3) not null default 0 check (min_qty >= 0),
  max_qty numeric(12, 3) not null default 0 check (max_qty >= 0),
  updated_at timestamptz not null default now(),
  constraint reception_linner_stock_max_gte_min check (max_qty >= min_qty)
);

alter table public.reception_linner_stock enable row level security;

create policy reception_linner_stock_select
  on public.reception_linner_stock for select to authenticated
  using (
    (select public.can_access_module('linner_recepcion'))
    or (select public.can_access_module('movimientos'))
    or (select public.can_access_module('reportes'))
  );

revoke all on table public.reception_linner_stock from public, anon;
grant select on table public.reception_linner_stock to authenticated;

create or replace function public.set_reception_linner_limits(
  p_product_id uuid,
  p_min numeric,
  p_max numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_manage_catalog() then
    raise exception 'Sin permiso para configurar el linner de recepción';
  end if;
  if p_min is null or p_max is null or p_min < 0 or p_max < 0 then
    raise exception 'Mínimo y máximo inválidos';
  end if;
  if p_max < p_min then
    raise exception 'El máximo no puede ser menor que el mínimo';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Producto no encontrado';
  end if;

  insert into public.reception_linner_stock (product_id, min_qty, max_qty)
  values (p_product_id, p_min, p_max)
  on conflict (product_id)
  do update set min_qty = excluded.min_qty, max_qty = excluded.max_qty, updated_at = now();
end;
$$;

revoke all on function public.set_reception_linner_limits(uuid, numeric, numeric) from public, anon;
grant execute on function public.set_reception_linner_limits(uuid, numeric, numeric) to authenticated;

create or replace function public.consume_reception_linner(
  p_product_id uuid,
  p_qty numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cat text;
  row public.reception_linner_stock%rowtype;
begin
  if not public.can_access_module('linner_recepcion') then
    raise exception 'Sin permiso para el linner de recepción';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;

  select c.code into cat
  from public.products p
  join public.product_categories c on c.id = p.category_id
  where p.id = p_product_id;
  if cat = 'BLAN' then
    raise exception 'Los blancos del linner de recepción se mueven en Control de blancos';
  end if;

  select * into row from public.reception_linner_stock where product_id = p_product_id for update;
  if not found or row.quantity < p_qty then
    raise exception 'Cantidad insuficiente en el linner de recepción';
  end if;

  update public.reception_linner_stock
  set quantity = quantity - p_qty, updated_at = now()
  where product_id = p_product_id;
end;
$$;

revoke all on function public.consume_reception_linner(uuid, numeric) from public, anon;
grant execute on function public.consume_reception_linner(uuid, numeric) to authenticated;

create or replace function public.stock_reception_linner(
  p_product_id uuid,
  p_qty numeric,
  p_reason text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cat text;
  linen uuid;
  rec_id uuid;
  ama_dept uuid;
begin
  if not public.can_access_module('movimientos') then
    raise exception 'Sin permiso para enviar al linner de recepción';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and is_active) then
    raise exception 'Producto no encontrado';
  end if;

  select c.code into cat
  from public.products p
  join public.product_categories c on c.id = p.category_id
  where p.id = p_product_id;

  if cat = 'BLAN' then
    select id into linen from public.linen_items where product_id = p_product_id;
    if linen is null then
      raise exception 'Registre el blanco en Control de blancos antes de enviarlo al linner';
    end if;
    select id into rec_id from public.storage_locations where code = 'REC' and is_active limit 1;
    if rec_id is null then
      raise exception 'No existe el linner de recepción';
    end if;
    perform public.stock_linner(linen, rec_id, p_qty);
    insert into public.reception_linner_stock (product_id, min_qty, max_qty)
    values (p_product_id, 0, 0)
    on conflict (product_id) do update set updated_at = now();
    return;
  end if;

  select id into ama_dept from public.departments where code = 'AMA' limit 1;

  insert into public.stock_movements (
    product_id, movement_type, quantity, department_id,
    reason, responsible_user_id, source_type, notes
  ) values (
    p_product_id, 'out', p_qty, ama_dept,
    coalesce(nullif(trim(p_reason), ''), 'Envío a linner de recepción'),
    auth.uid(), 'reception_linner', p_notes
  );

  insert into public.reception_linner_stock (product_id, quantity)
  values (p_product_id, p_qty)
  on conflict (product_id)
  do update set quantity = public.reception_linner_stock.quantity + excluded.quantity, updated_at = now();
end;
$$;

revoke all on function public.stock_reception_linner(uuid, numeric, text, text) from public, anon;
grant execute on function public.stock_reception_linner(uuid, numeric, text, text) to authenticated;
