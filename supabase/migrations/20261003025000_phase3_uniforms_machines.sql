-- Uniformes: ajuste auditado y asignación solo HR/admin.
-- Maquinaria: transiciones válidas e historial.

create table if not exists public.uniform_sku_adjustments (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.uniform_skus (id) on delete restrict,
  delta_total numeric(12, 3) not null check (delta_total <> 0),
  reason text not null,
  adjusted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.uniform_sku_adjustments enable row level security;

drop policy if exists uniform_sku_adjustments_select on public.uniform_sku_adjustments;
create policy uniform_sku_adjustments_select
  on public.uniform_sku_adjustments for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists uniform_skus_write on public.uniform_skus;
create policy uniform_skus_write on public.uniform_skus for all to authenticated
  using ((select public.has_hr_scope()))
  with check ((select public.has_hr_scope()));

create or replace function public.adjust_uniform_sku(
  p_sku_id uuid,
  p_delta numeric,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sku public.uniform_skus%rowtype;
begin
  if not public.has_hr_scope() then
    raise exception 'Sin permiso para ajustar uniformes';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'El ajuste debe ser distinto de cero';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio';
  end if;

  select * into sku from public.uniform_skus where id = p_sku_id for update;
  if not found then
    raise exception 'Uniforme no encontrado';
  end if;
  if sku.available + p_delta < 0 or sku.total + p_delta < 0 then
    raise exception 'El ajuste dejaría existencia negativa';
  end if;

  update public.uniform_skus
  set total = total + p_delta,
      available = available + p_delta,
      updated_at = now()
  where id = p_sku_id;

  insert into public.uniform_sku_adjustments (sku_id, delta_total, reason, adjusted_by)
  values (p_sku_id, p_delta, trim(p_reason), auth.uid());
end;
$$;

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
  if p_worker_name is null or length(trim(p_worker_name)) = 0 then
    raise exception 'Trabajador obligatorio';
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
  if not public.has_hr_scope() then
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

revoke all on function public.adjust_uniform_sku(uuid, numeric, text) from public, anon;
grant execute on function public.adjust_uniform_sku(uuid, numeric, text) to authenticated;

alter table public.machine_tickets
  add column if not exists delivered_at timestamptz,
  add column if not exists repair_started_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists laundry_responsible text;

create table if not exists public.machine_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.machine_tickets (id) on delete cascade,
  from_status public.machine_ticket_status,
  to_status public.machine_ticket_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.machine_ticket_events enable row level security;

drop policy if exists machine_ticket_events_select on public.machine_ticket_events;
create policy machine_ticket_events_select
  on public.machine_ticket_events for select to authenticated
  using ((select public.is_active_user()));

create or replace function public.guard_machine_ticket_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from 'reportada' then
    raise exception 'Un ticket nuevo empieza en Reportada';
  end if;
  return new;
end;
$$;

create or replace function public.log_machine_ticket_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.machine_ticket_events (ticket_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, auth.uid());
  return new;
end;
$$;

create or replace function public.guard_machine_ticket_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not (
    (old.status = 'reportada' and new.status = 'entregada')
    or (old.status = 'entregada' and new.status = 'en_reparacion')
    or (old.status = 'en_reparacion' and new.status in ('reparada', 'fuera_de_servicio'))
  ) then
    raise exception 'Transición de ticket no permitida: % → %', old.status, new.status;
  end if;

  if new.status = 'entregada' then
    new.delivered_at := coalesce(new.delivered_at, now());
  elsif new.status = 'en_reparacion' then
    new.repair_started_at := coalesce(new.repair_started_at, now());
  elsif new.status in ('reparada', 'fuera_de_servicio') then
    new.closed_at := coalesce(new.closed_at, now());
  end if;

  insert into public.machine_ticket_events (ticket_id, from_status, to_status, changed_by)
  values (new.id, old.status, new.status, auth.uid());

  return new;
end;
$$;

drop trigger if exists machine_tickets_guard_insert on public.machine_tickets;
create trigger machine_tickets_guard_insert
before insert on public.machine_tickets
for each row execute function public.guard_machine_ticket_insert();

drop trigger if exists machine_tickets_log_insert on public.machine_tickets;
create trigger machine_tickets_log_insert
after insert on public.machine_tickets
for each row execute function public.log_machine_ticket_insert();

drop trigger if exists machine_tickets_guard_transition on public.machine_tickets;
create trigger machine_tickets_guard_transition
before update on public.machine_tickets
for each row execute function public.guard_machine_ticket_transition();

grant select on public.uniform_sku_adjustments, public.machine_ticket_events to authenticated;
