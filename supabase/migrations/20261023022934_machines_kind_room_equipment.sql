create type public.machine_kind as enum ('laundry_machine', 'room_equipment');

alter table public.machines
  add column kind public.machine_kind not null default 'laundry_machine';

comment on column public.machines.kind is 'laundry_machine = lavandería; room_equipment = equipos de habitación';
