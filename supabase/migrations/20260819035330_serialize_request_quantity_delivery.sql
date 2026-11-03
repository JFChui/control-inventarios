-- Serialize approved-quantity edits and request delivery on the request header.

create or replace function public.update_supply_request_line_qty(
  p_line_id uuid,
  p_qty numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_status public.supply_request_status;
begin
  if not public.has_manage_catalog() then
    raise exception 'Sin permiso para modificar cantidades';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Cantidad inválida';
  end if;

  -- Read the immutable parent id, then acquire the same header lock used by
  -- delivery before touching the line.
  select request_id
  into v_request_id
  from public.supply_request_lines
  where id = p_line_id;

  if not found then
    raise exception 'Línea de solicitud no encontrada';
  end if;

  select status
  into v_status
  from public.supply_requests
  where id = v_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if v_status not in ('pending', 'approved') then
    raise exception 'Solo se pueden modificar solicitudes pendientes o aprobadas';
  end if;

  update public.supply_request_lines
  set quantity_approved = p_qty
  where id = p_line_id
    and request_id = v_request_id;

  if not found then
    raise exception 'Línea de solicitud no encontrada';
  end if;
end;
$$;

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
  line_count integer := 0;
begin
  if not public.has_manage_catalog() then
    raise exception 'Sin permiso para entregar solicitudes';
  end if;

  select *
  into r
  from public.supply_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if r.status is distinct from 'approved' then
    raise exception 'Solo se pueden entregar solicitudes aprobadas';
  end if;

  for line in
    select *
    from public.supply_request_lines
    where request_id = p_request_id
    order by id
    for update
  loop
    line_count := line_count + 1;
    qty := coalesce(line.quantity_approved, line.quantity_requested);

    if qty is null or qty <= 0 then
      raise exception 'Cantidad inválida en línea de solicitud';
    end if;

    insert into public.stock_movements (
      product_id,
      movement_type,
      quantity,
      department_id,
      reason,
      responsible_user_id,
      source_type,
      source_id,
      notes
    )
    values (
      line.product_id,
      'out',
      qty,
      r.department_id,
      'Entrega solicitud #' || r.request_number::text,
      auth.uid(),
      'request',
      r.id,
      'supply_request_line:' || line.id::text
    );

    update public.supply_request_lines
    set quantity_approved = qty
    where id = line.id
      and quantity_approved is null;
  end loop;

  if line_count = 0 then
    raise exception 'La solicitud no contiene productos';
  end if;

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

-- All approved-quantity writes must pass through the header-locking RPC.
drop policy if exists supply_request_lines_update
  on public.supply_request_lines;
revoke update on table public.supply_request_lines from authenticated;

revoke all on function public.update_supply_request_line_qty(uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.update_supply_request_line_qty(uuid, numeric)
  to authenticated;

revoke all on function public.deliver_supply_request(uuid)
  from public, anon;
grant execute on function public.deliver_supply_request(uuid)
  to authenticated;
