-- Fix RLS recursion on profiles policies
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.has_write_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'supervisor', 'staff')
  );
$$;

create or replace function public.has_manage_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'supervisor')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.has_write_role() from public;
revoke all on function public.has_manage_role() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.has_write_role() to authenticated;
grant execute on function public.has_manage_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;

alter function public.set_updated_at() set search_path = public;

drop policy if exists profiles_manage_admin on public.profiles;
create policy profiles_manage_admin
  on public.profiles for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
