-- Blancos activos = existencia del producto. La baja genera una sola salida de kardex.
-- Inventario físico: departamento y cierre inmutable.

create or replace function public.assert_linen_matches_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
  v_active numeric;
begin
  select quantity_on_hand into v_stock
  from public.products
  where id = p_product_id;

  select available + in_use + in_laundry + damaged
  into v_active
  from public.linen_items
  where product_id = p_product_id;

  if v_active is null then
    return;
  end if;

  if v_active is distinct from v_stock then
    raise exception
      'Blancos activos (%) no coinciden con la existencia (%)',
      v_active, v_stock;
  end if;
end;
$$;

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

revoke all on function public.assert_linen_matches_product(uuid) from public, anon;
grant execute on function public.assert_linen_matches_product(uuid) to authenticated;

create or replace view public.v_linen_summary as
select
  p.id as product_id,
  li.id as linen_id,
  p.code,
  p.name,
  p.quantity_on_hand,
  coalesce(li.available, 0) as available,
  coalesce(li.in_use, 0) as in_use,
  coalesce(li.in_laundry, 0) as in_laundry,
  coalesce(li.damaged, 0) as damaged,
  coalesce(li.written_off, 0) as written_off,
  coalesce(li.available, 0) + coalesce(li.in_use, 0)
    + coalesce(li.in_laundry, 0) + coalesce(li.damaged, 0) as active_qty,
  (coalesce(li.available, 0) + coalesce(li.in_use, 0)
    + coalesce(li.in_laundry, 0) + coalesce(li.damaged, 0))
    - p.quantity_on_hand as drift
from public.products p
join public.product_categories c on c.id = p.category_id
left join public.linen_items li on li.product_id = p.id
where c.code = 'BLAN'
  and p.is_active = true;

grant select on public.v_linen_summary to authenticated;

alter table public.physical_counts
  add column if not exists department_id uuid references public.departments (id) on delete set null;

create index if not exists physical_counts_department_id_idx
  on public.physical_counts (department_id);

create or replace function public.prevent_posted_count_edits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status public.physical_count_status;
begin
  select status into v_status
  from public.physical_counts
  where id = coalesce(new.count_id, old.count_id);

  if v_status = 'posted' then
    raise exception 'El conteo cerrado no se puede editar';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists physical_count_lines_immutable_when_posted
  on public.physical_count_lines;

create trigger physical_count_lines_immutable_when_posted
before insert or update or delete on public.physical_count_lines
for each row execute function public.prevent_posted_count_edits();
