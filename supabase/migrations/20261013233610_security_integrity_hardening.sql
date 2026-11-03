-- Views: enforce RLS of the querying user and Caracas month buckets.
create or replace view public.v_linen_summary
with (security_invoker = true) as
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

create or replace view public.v_monthly_consumption_by_category
with (security_invoker = true) as
select
  date_trunc('month', m.occurred_at at time zone 'America/Caracas')::date as year_month,
  c.code as category_code,
  c.name as category_name,
  sum(m.quantity) as quantity_out
from public.stock_movements m
join public.products p on p.id = m.product_id
join public.product_categories c on c.id = p.category_id
where m.movement_type = 'out'
group by 1, 2, 3;

grant select on public.v_monthly_consumption_by_category to authenticated;

-- Trigger/helpers are not API endpoints.
revoke all on function public.guard_machine_ticket_insert() from public, anon, authenticated;
revoke all on function public.guard_machine_ticket_transition() from public, anon, authenticated;
revoke all on function public.log_machine_ticket_insert() from public, anon, authenticated;
revoke all on function public.prevent_posted_count_edits() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.assert_linen_matches_product(uuid) from public, anon, authenticated;

-- Integrity guards: only block direct API writes (authenticated/anon).
create or replace function public.guard_product_qty_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.quantity_on_hand is distinct from 0 then
      raise exception 'La existencia solo se carga con un movimiento o un conteo.';
    end if;
    if new.inventory_initialized_at is not null then
      raise exception 'La inicialización del inventario solo ocurre vía kardex.';
    end if;
    return new;
  end if;
  if new.quantity_on_hand is distinct from old.quantity_on_hand
     or new.inventory_initialized_at is distinct from old.inventory_initialized_at then
    raise exception 'La existencia solo cambia con movimientos de kardex.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_product_qty_integrity on public.products;
create trigger guard_product_qty_integrity
before insert or update on public.products
for each row execute function public.guard_product_qty_integrity();

revoke all on function public.guard_product_qty_integrity() from public, anon, authenticated;

create or replace function public.guard_physical_count_line_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_qty numeric;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select quantity_on_hand into v_qty from public.products where id = new.product_id;
    new.system_qty := coalesce(v_qty, 0);
    return new;
  end if;
  if new.system_qty is distinct from old.system_qty
     or new.product_id is distinct from old.product_id
     or new.count_id is distinct from old.count_id then
    raise exception 'Solo se puede editar la cantidad contada.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_physical_count_line_integrity on public.physical_count_lines;
create trigger guard_physical_count_line_integrity
before insert or update on public.physical_count_lines
for each row execute function public.guard_physical_count_line_integrity();

revoke all on function public.guard_physical_count_line_integrity() from public, anon, authenticated;

create or replace function public.guard_physical_count_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception 'Un conteo nuevo solo puede crearse en borrador.';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'El estado del conteo solo cambia al cerrarlo.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_physical_count_status on public.physical_counts;
create trigger guard_physical_count_status
before insert or update on public.physical_counts
for each row execute function public.guard_physical_count_status();

revoke all on function public.guard_physical_count_status() from public, anon, authenticated;

create or replace function public.guard_maid_allocation_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception 'Una dotación nueva solo puede crearse en borrador.';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'El estado de la dotación solo cambia al confirmarla.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_maid_allocation_status on public.maid_allocations;
create trigger guard_maid_allocation_status
before insert or update on public.maid_allocations
for each row execute function public.guard_maid_allocation_status();

revoke all on function public.guard_maid_allocation_status() from public, anon, authenticated;

-- Direct API writes: linen/uniforms insert-only; assignments only via RPC.
drop policy if exists linen_items_write on public.linen_items;
create policy linen_items_insert on public.linen_items
  for insert to authenticated
  with check ((select public.can_access_module('blancos')));

drop policy if exists uniform_skus_write on public.uniform_skus;
create policy uniform_skus_insert on public.uniform_skus
  for insert to authenticated
  with check ((select public.has_hr_scope()));

drop policy if exists uniform_assignments_insert on public.uniform_assignments;
drop policy if exists uniform_assignments_update on public.uniform_assignments;

alter table public.physical_count_lines
  drop constraint if exists physical_count_lines_counted_qty_nonneg;
alter table public.physical_count_lines
  add constraint physical_count_lines_counted_qty_nonneg
  check (counted_qty is null or counted_qty >= 0);

drop policy if exists supply_requests_select on public.supply_requests;
create policy supply_requests_select on public.supply_requests
  for select to authenticated
  using ((select public.has_manage_catalog()));

drop policy if exists supply_request_lines_select on public.supply_request_lines;
create policy supply_request_lines_select on public.supply_request_lines
  for select to authenticated
  using ((select public.has_manage_catalog()));

create index if not exists machine_ticket_events_changed_by_idx
  on public.machine_ticket_events (changed_by);
create index if not exists machine_ticket_events_ticket_id_idx
  on public.machine_ticket_events (ticket_id);
create index if not exists machine_tickets_reported_by_idx
  on public.machine_tickets (reported_by);
create index if not exists maid_allocations_created_by_idx
  on public.maid_allocations (created_by);
create index if not exists monthly_occupancy_updated_by_idx
  on public.monthly_occupancy (updated_by);
create index if not exists physical_count_lines_product_id_idx
  on public.physical_count_lines (product_id);
create index if not exists physical_counts_responsible_user_id_idx
  on public.physical_counts (responsible_user_id);
create index if not exists supply_request_lines_product_id_idx
  on public.supply_request_lines (product_id);
create index if not exists supply_requests_delivered_by_idx
  on public.supply_requests (delivered_by);
create index if not exists supply_requests_requested_by_idx
  on public.supply_requests (requested_by);
create index if not exists supply_requests_reviewed_by_idx
  on public.supply_requests (reviewed_by);
create index if not exists uniform_assignments_assigned_by_idx
  on public.uniform_assignments (assigned_by);
create index if not exists uniform_sku_adjustments_adjusted_by_idx
  on public.uniform_sku_adjustments (adjusted_by);
create index if not exists uniform_sku_adjustments_sku_id_idx
  on public.uniform_sku_adjustments (sku_id);
create index if not exists uniform_skus_department_id_idx
  on public.uniform_skus (department_id);
