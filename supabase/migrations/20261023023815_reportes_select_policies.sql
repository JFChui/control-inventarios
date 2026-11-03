-- Floor supervisors with reportes can read satellite tables for the new reports.
drop policy if exists machines_select on public.machines;
create policy machines_select on public.machines for select to authenticated
  using (
    (select public.can_access_module('maquinaria'))
    or (select public.can_access_module('reportes'))
  );

drop policy if exists machine_tickets_select on public.machine_tickets;
create policy machine_tickets_select on public.machine_tickets for select to authenticated
  using (
    (select public.can_access_module('maquinaria'))
    or (select public.can_access_module('reportes'))
  );

drop policy if exists machine_ticket_events_select on public.machine_ticket_events;
create policy machine_ticket_events_select on public.machine_ticket_events for select to authenticated
  using (
    (select public.can_access_module('maquinaria'))
    or (select public.can_access_module('reportes'))
  );

drop policy if exists linen_items_select on public.linen_items;
create policy linen_items_select on public.linen_items for select to authenticated
  using (
    (select public.can_access_module('blancos'))
    or (select public.can_access_module('reportes'))
  );

drop policy if exists uniform_skus_select on public.uniform_skus;
create policy uniform_skus_select on public.uniform_skus for select to authenticated
  using (
    (select public.can_access_module('uniformes'))
    or (select public.can_access_module('reportes'))
  );

drop policy if exists uniform_assignments_select on public.uniform_assignments;
create policy uniform_assignments_select on public.uniform_assignments for select to authenticated
  using (
    (select public.can_access_module('uniformes'))
    or (select public.can_access_module('reportes'))
  );

drop policy if exists uniform_workers_select on public.uniform_workers;
create policy uniform_workers_select on public.uniform_workers for select to authenticated
  using (
    (select public.can_access_module('uniformes'))
    or (select public.can_access_module('reportes'))
  );
