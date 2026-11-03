create type public.employment_type as enum ('fijo', 'eventual');

alter table public.uniform_workers
  add column employment_type public.employment_type not null default 'fijo';

alter table public.uniform_skus
  add column unusable numeric(12, 3) not null default 0 check (unusable >= 0);

alter table public.uniform_skus drop constraint if exists uniform_skus_balance;
alter table public.uniform_skus
  add constraint uniform_skus_balance check (total = available + in_use + unusable);

alter table public.uniform_sku_adjustments
  add column if not exists delta_unusable numeric(12, 3) not null default 0;

alter table public.uniform_sku_adjustments
  drop constraint if exists uniform_sku_adjustments_delta_total_check;

alter table public.uniform_sku_adjustments
  add constraint uniform_sku_adjustments_delta_check
  check (delta_total <> 0 or delta_unusable <> 0);

create or replace function public.mark_uniform_unusable(
  p_sku_id uuid,
  p_qty numeric,
  p_from text,
  p_reason text,
  p_assignment_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sku public.uniform_skus%rowtype;
  a public.uniform_assignments%rowtype;
begin
  if not public.has_hr_scope() then
    raise exception 'Sin permiso para marcar uniformes no utilizables';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'El motivo es obligatorio';
  end if;
  if p_from not in ('available', 'in_use') then
    raise exception 'Origen inválido';
  end if;

  select * into sku from public.uniform_skus where id = p_sku_id for update;
  if not found then
    raise exception 'Uniforme no encontrado';
  end if;

  if p_from = 'available' then
    if sku.available < p_qty then
      raise exception 'No hay suficientes prendas en RR.HH.';
    end if;
    update public.uniform_skus
    set available = available - p_qty,
        unusable = unusable + p_qty,
        updated_at = now()
    where id = p_sku_id;
  else
    if p_assignment_id is null then
      raise exception 'Indique la asignación a dar de baja como no utilizable';
    end if;
    select * into a from public.uniform_assignments where id = p_assignment_id for update;
    if not found then
      raise exception 'Asignación no encontrada';
    end if;
    if a.sku_id is distinct from p_sku_id then
      raise exception 'La asignación no corresponde a esa prenda';
    end if;
    if a.returned_at is not null then
      raise exception 'La asignación ya está cerrada';
    end if;
    if a.quantity is distinct from p_qty then
      raise exception 'La cantidad debe coincidir con la asignación abierta';
    end if;
    update public.uniform_skus
    set in_use = in_use - p_qty,
        unusable = unusable + p_qty,
        updated_at = now()
    where id = p_sku_id;
    update public.uniform_assignments
    set returned_at = now(),
        notes = trim(coalesce(notes || ' · ', '') || 'No utilizable: ' || trim(p_reason))
    where id = p_assignment_id;
  end if;

  insert into public.uniform_sku_adjustments (
    sku_id, delta_total, delta_unusable, reason, adjusted_by
  ) values (
    p_sku_id, 0, p_qty, trim(p_reason), auth.uid()
  );
end;
$$;

revoke all on function public.mark_uniform_unusable(uuid, numeric, text, text, uuid) from public, anon;
grant execute on function public.mark_uniform_unusable(uuid, numeric, text, text, uuid) to authenticated;
