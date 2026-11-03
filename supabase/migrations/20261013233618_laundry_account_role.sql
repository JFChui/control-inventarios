-- The live Lavandería account was left as floor_supervisor_a and could not
-- open Blancos or Maquinaria. Align it with the laundry supervisor cargo.
update public.profiles p
set role = 'laundry_supervisor',
    updated_at = now()
from public.departments d
where p.department_id = d.id
  and d.code = 'LAV'
  and p.role = 'floor_supervisor_a';
