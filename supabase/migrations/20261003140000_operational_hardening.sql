-- Existencia inicial: no alertar productos nunca contados ni movidos.
-- El inventario físico de apertura marca inventory_initialized_at aunque la
-- diferencia sea 0, y reconcilia linen_items con quantity_on_hand.

alter table public.products
  add column if not exists inventory_initialized_at timestamptz;

comment on column public.products.inventory_initialized_at is
  'Primera vez que el producto se contó o movió. NULL = sin conteo / sin kardex.';

update public.products p
set inventory_initialized_at = (
  select min(sm.occurred_at)
  from public.stock_movements sm
  where sm.product_id = p.id
)
where p.inventory_initialized_at is null
  and exists (
    select 1 from public.stock_movements sm where sm.product_id = p.id
  );

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  if new.movement_type = 'in' then
    update public.products
    set quantity_on_hand = quantity_on_hand + new.quantity,
        inventory_initialized_at = coalesce(inventory_initialized_at, now()),
        updated_at = now()
    where id = new.product_id
      and is_active = true;

    get diagnostics updated_rows = row_count;
    if updated_rows = 0 then
      raise exception 'Producto inexistente o inactivo: %', new.product_id;
    end if;

  elsif new.movement_type = 'out' then
    update public.products
    set quantity_on_hand = quantity_on_hand - new.quantity,
        inventory_initialized_at = coalesce(inventory_initialized_at, now()),
        updated_at = now()
    where id = new.product_id
      and is_active = true
      and quantity_on_hand >= new.quantity;

    get diagnostics updated_rows = row_count;
    if updated_rows = 0 then
      raise exception 'Stock insuficiente o producto inactivo: %', new.product_id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.apply_stock_movement() from public, anon, authenticated;

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

revoke all on function public.post_physical_count(uuid) from public, anon;
grant execute on function public.post_physical_count(uuid) to authenticated;

drop view if exists public.v_products_low_stock;
drop view if exists public.v_products_stock_status;

create view public.v_products_stock_status
with (security_invoker = true)
as
select
  p.*,
  case
    when p.inventory_initialized_at is null then 'sin_conteo'
    when p.quantity_on_hand <= 0 then 'agotado'
    when p.min_stock <= 0 then 'normal'
    when p.quantity_on_hand <= p.min_stock then 'bajo'
    when p.quantity_on_hand <= p.min_stock * 1.25 then 'proximo'
    else 'normal'
  end as stock_status
from public.products p
where p.is_active = true;

create view public.v_products_low_stock
with (security_invoker = true)
as
select *
from public.v_products_stock_status
where stock_status in ('agotado', 'bajo');

grant select on public.v_products_low_stock, public.v_products_stock_status to authenticated;
