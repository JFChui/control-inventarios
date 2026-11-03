- PadrÃ³n de uniformes (personal del hotel) + asignaciÃ³n por worker_id.
-- staff_department es texto del hotel; no toca public.departments.

create table if not exists public.uniform_workers (
  id uuid primary key default gen_random_uuid(),
  uniform_code text not null unique,
  last_name text not null,
  first_name text not null,
  staff_department text not null,
  position text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists uniform_workers_set_updated_at on public.uniform_workers;
create trigger uniform_workers_set_updated_at
before update on public.uniform_workers
for each row execute function public.set_updated_at();

alter table public.uniform_workers enable row level security;

drop policy if exists uniform_workers_select on public.uniform_workers;
create policy uniform_workers_select
  on public.uniform_workers for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists uniform_workers_write on public.uniform_workers;
create policy uniform_workers_write
  on public.uniform_workers for all
  to authenticated
  using ((select public.has_hr_scope()))
  with check ((select public.has_hr_scope()));

revoke all on table public.uniform_workers from public, anon;
grant select, insert, update on table public.uniform_workers to authenticated;

alter table public.uniform_assignments
  add column if not exists worker_id uuid references public.uniform_workers (id) on delete restrict;

create index if not exists uniform_assignments_worker_id_idx
  on public.uniform_assignments (worker_id);

drop function if exists public.assign_uniform(uuid, text, numeric, text);

create or replace function public.assign_uniform(
  p_sku_id uuid,
  p_worker_id uuid,
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
  worker public.uniform_workers%rowtype;
  new_id uuid;
  display_name text;
begin
  if not public.has_hr_scope() then
    raise exception 'Sin permiso para asignar uniformes';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad invÃ¡lida';
  end if;
  if p_worker_id is null then
    raise exception 'Trabajador obligatorio';
  end if;

  select * into worker
  from public.uniform_workers
  where id = p_worker_id;

  if not found then
    raise exception 'Trabajador no encontrado';
  end if;
  if not worker.is_active then
    raise exception 'El trabajador estÃ¡ inactivo';
  end if;

  display_name := worker.uniform_code || ' â€” ' || worker.last_name || ' ' || worker.first_name;

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

  insert into public.uniform_assignments (sku_id, worker_id, worker_name, quantity, assigned_by, notes)
  values (p_sku_id, worker.id, display_name, p_qty, auth.uid(), p_notes)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.assign_uniform(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.assign_uniform(uuid, uuid, numeric, text) to authenticated;

-- SKUs de prueba del arranque: 0 asignaciones y 0 ajustes.
delete from public.uniform_skus
where code in ('UNI-1', '1455');

insert into public.uniform_workers (
  uniform_code, last_name, first_name, staff_department, position
)
values
  ('1001', 'GARCIA LOPEZ', 'ANA MARIA', 'AMA DE LLAVES', 'SUPERVISORA DE PISO'),
  ('1002', 'PEREZ RIVAS', 'CARLOS JOSE', 'LAVANDERIA', 'SUPERVISOR DE LAVANDERIA'),
  ('1003', 'MARTINEZ DIAZ', 'LUISA FERNANDA', 'RECURSOS HUMANOS', 'ANALISTA DE RECURSOS HUMANOS'),
  ('1004', 'RODRIGUEZ SILVA', 'MIGUEL ANGEL', 'ESTILO', 'ESTILISTA'),
  ('1005', 'FERNANDEZ RUIZ', 'SOFIA ELENA', 'LENCERIA', 'SUPERVISORA DE LENCERIA'),
  ('1006', 'SANCHEZ TORRES', 'PEDRO LUIS', 'SUMINISTRO HUESPED', 'SUPERVISOR DE SUMINISTRO'),
  ('1007', 'RAMIREZ VEGA', 'ELENA PATRICIA', 'MANTENIMIENTO', 'TECNICO DE MANTENIMIENTO'),
  ('1008', 'GOMEZ CASTRO', 'JUAN PABLO', 'COCINA', 'COCINERO'),
  ('1009', 'DIAZ MORENO', 'MARIA CAMILA', 'RECEPCION', 'RECEPCIONISTA'),
  ('1010', 'HERRERA NUNEZ', 'ANDRES FELIPE', 'SEGURIDAD', 'AGENTE DE SEGURIDAD')
on conflict (uniform_code) do update
set last_name = excluded.last_name,
    first_name = excluded.first_name,
    staff_department = excluded.staff_department,
    position = excluded.position,
    is_active = true,
    updated_at = now();
