-- Rectify a confirmed maid allocation: replace counts and post kardex deltas.
alter table public.maid_allocations
  add column if not exists revised_at timestamptz,
  add column if not exists revision_count integer not null default 0;

create or replace function public.guard_maid_allocation_counts()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_allocation_id uuid;
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  v_allocation_id := coalesce(new.allocation_id, old.allocation_id);
  select status into v_status
  from public.maid_allocations
  where id = v_allocation_id;

  if v_status = 'confirmed' then
    raise exception 'Los conteos de una dotación confirmada solo cambian al rectificarla.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_maid_allocation_counts on public.maid_allocation_counts;
create trigger guard_maid_allocation_counts
before insert or update or delete on public.maid_allocation_counts
for each row execute function public.guard_maid_allocation_counts();

revoke all on function public.guard_maid_allocation_counts() from public, anon, authenticated;

create or replace function public.revise_maid_allocation(
  p_allocation_id uuid,
  p_counts jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.maid_allocations%rowtype;
  need record;
  delta numeric;
  ama_dept uuid;
  v_count integer;
begin
  if not public.can_access_module('dotacion') then
    raise exception 'Sin permiso para rectificar dotación';
  end if;

  if p_counts is null or jsonb_typeof(p_counts) <> 'array' then
    raise exception 'Los conteos deben enviarse como lista';
  end if;

  select * into a from public.maid_allocations where id = p_allocation_id for update;
  if not found then
    raise exception 'Dotación no encontrada';
  end if;
  if a.status is distinct from 'confirmed' then
    raise exception 'Solo se rectifica una dotación confirmada';
  end if;

  select count(*) into v_count
  from jsonb_to_recordset(p_counts) as x(room_type text, service_type text, room_count integer)
  where x.room_type is not null and btrim(x.room_type) <> ''
    and x.service_type is not null
    and x.room_count is not null and x.room_count > 0;

  if coalesce(v_count, 0) = 0 then
    raise exception 'Indica al menos un conteo de habitaciones';
  end if;

  delete from public.maid_allocation_counts where allocation_id = p_allocation_id;

  insert into public.maid_allocation_counts (
    allocation_id, room_type, service_type, room_count
  )
  select
    p_allocation_id,
    btrim(x.room_type),
    x.service_type::public.room_service_type,
    sum(x.room_count)::integer
  from jsonb_to_recordset(p_counts) as x(room_type text, service_type text, room_count integer)
  where x.room_type is not null and btrim(x.room_type) <> ''
    and x.service_type is not null
    and x.room_count is not null and x.room_count > 0
  group by 1, 2, 3;

  select id into ama_dept from public.departments where code = 'AMA' limit 1;

  for need in
    with new_need as (
      select p.product_id, sum(c.room_count * p.qty_per_room) as total_qty
      from public.maid_allocation_counts c
      join public.room_supply_params p
        on p.room_type = c.room_type
       and p.service_type = c.service_type
      where c.allocation_id = p_allocation_id
      group by p.product_id
    ),
    posted_qty as (
      select sm.product_id,
        coalesce(sum(case
          when sm.movement_type = 'out' then sm.quantity
          when sm.movement_type = 'in' then -sm.quantity
          else 0
        end), 0) as posted
      from public.stock_movements sm
      where sm.source_type = 'maid_allocation'
        and sm.source_id = p_allocation_id
      group by sm.product_id
    )
    select
      coalesce(n.product_id, q.product_id) as product_id,
      coalesce(n.total_qty, 0) as total_qty,
      coalesce(q.posted, 0) as posted
    from new_need n
    full outer join posted_qty q on q.product_id = n.product_id
    where coalesce(n.total_qty, 0) <> coalesce(q.posted, 0)
  loop
    delta := need.total_qty - need.posted;
    if delta > 0 then
      insert into public.stock_movements (
        product_id, movement_type, quantity, department_id,
        reason, responsible_user_id, source_type, source_id, notes
      ) values (
        need.product_id, 'out', delta, ama_dept,
        'Rectificación dotación ' || a.maid_name,
        auth.uid(), 'maid_allocation', p_allocation_id,
        'Fecha ' || a.allocation_date::text
      );
    elsif delta < 0 then
      insert into public.stock_movements (
        product_id, movement_type, quantity, department_id,
        reason, responsible_user_id, source_type, source_id, notes
      ) values (
        need.product_id, 'in', abs(delta), ama_dept,
        'Rectificación dotación ' || a.maid_name,
        auth.uid(), 'maid_allocation', p_allocation_id,
        'Fecha ' || a.allocation_date::text
      );
    end if;
  end loop;

  update public.maid_allocations
  set revised_at = now(),
      revision_count = coalesce(revision_count, 0) + 1,
      updated_at = now()
  where id = p_allocation_id;
end;
$$;

revoke all on function public.revise_maid_allocation(uuid, jsonb) from public, anon;
grant execute on function public.revise_maid_allocation(uuid, jsonb) to authenticated;
