-- Add cargo role values. They cannot be used until this transaction commits.
alter type public.app_role add value if not exists 'senior_design_manager';
alter type public.app_role add value if not exists 'design_manager';
alter type public.app_role add value if not exists 'hr_manager';
alter type public.app_role add value if not exists 'laundry_supervisor';
alter type public.app_role add value if not exists 'floor_supervisor_a';
alter type public.app_role add value if not exists 'floor_supervisor_b';
alter type public.app_role add value if not exists 'floor_supervisor_c';
