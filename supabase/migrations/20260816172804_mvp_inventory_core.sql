-- MVP inventory core: departments, profiles, categories, products, kardex
-- Stock source of truth: products.quantity_on_hand updated by trigger on stock_movements

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'supervisor', 'staff', 'readonly');
create type public.stock_movement_type as enum ('in', 'out');

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  department_id uuid references public.departments (id) on delete set null,
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_department_id_idx on public.profiles (department_id);
create index profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Product categories
-- ---------------------------------------------------------------------------
create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category_id uuid not null references public.product_categories (id) on delete restrict,
  unit text not null,
  quantity_on_hand numeric(12, 3) not null default 0
    check (quantity_on_hand >= 0),
  min_stock numeric(12, 3) not null default 0
    check (min_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);
create index products_is_active_idx on public.products (is_active);
create index products_low_stock_idx on public.products (quantity_on_hand, min_stock)
  where is_active = true;

-- ---------------------------------------------------------------------------
-- Stock movements (kardex) — append-only for authenticated roles
-- ---------------------------------------------------------------------------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  movement_type public.stock_movement_type not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  occurred_at timestamptz not null default now(),
  department_id uuid references public.departments (id) on delete set null,
  supplier text,
  reason text,
  responsible_user_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index stock_movements_product_id_idx on public.stock_movements (product_id);
create index stock_movements_department_id_idx on public.stock_movements (department_id);
create index stock_movements_responsible_user_id_idx on public.stock_movements (responsible_user_id);
create index stock_movements_occurred_at_idx on public.stock_movements (occurred_at desc);
create index stock_movements_type_idx on public.stock_movements (movement_type);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security invoker
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.has_write_role()
returns boolean
language sql
stable
security invoker
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
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'supervisor')
  );
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'staff'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Prevent non-admins from changing their own role
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- SQL Editor / migraciones (sin JWT) pueden ajustar roles
    if (select auth.uid()) is null then
      return new;
    end if;

    if not exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    ) then
      raise exception 'Solo un admin puede cambiar roles';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
before update on public.profiles
for each row execute function public.prevent_profile_role_escalation();

-- ---------------------------------------------------------------------------
-- Stock application trigger (atomic with movement insert)
-- ---------------------------------------------------------------------------
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_rows int;
begin
  if new.movement_type = 'in' then
    update public.products
    set quantity_on_hand = quantity_on_hand + new.quantity,
        updated_at = now()
    where id = new.product_id
      and is_active = true;

    get diagnostics updated_rows = row_count;
    if updated_rows = 0 then
      raise exception 'Producto inexistente o inactivo: %', new.product_id;
    end if;

  elsif new.movement_type = 'out' then
    update public.products
    set quantity_on_hand = quantity_on_hand - new.quantity,
        updated_at = now()
    where id = new.product_id
      and is_active = true
      and quantity_on_hand >= new.quantity;

    get diagnostics updated_rows = row_count;
    if updated_rows = 0 then
      raise exception 'Stock insuficiente o producto inactivo: %', new.product_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger stock_movements_apply_stock
after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

-- ---------------------------------------------------------------------------
-- Views (security_invoker so RLS on products applies)
-- ---------------------------------------------------------------------------
create view public.v_products_low_stock
with (security_invoker = true)
as
select
  p.*,
  case
    when p.quantity_on_hand <= 0 then 'agotado'
    when p.quantity_on_hand <= p.min_stock then 'bajo'
    when p.quantity_on_hand <= p.min_stock * 1.25 then 'proximo'
    else 'normal'
  end as stock_status
from public.products p
where p.is_active = true
  and p.quantity_on_hand <= p.min_stock;

create view public.v_products_stock_status
with (security_invoker = true)
as
select
  p.*,
  case
    when p.quantity_on_hand <= 0 then 'agotado'
    when p.quantity_on_hand <= p.min_stock then 'bajo'
    when p.quantity_on_hand <= p.min_stock * 1.25 then 'proximo'
    else 'normal'
  end as stock_status
from public.products p
where p.is_active = true;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

-- departments
create policy departments_select_authenticated
  on public.departments for select
  to authenticated
  using (true);

create policy departments_write_manage
  on public.departments for all
  to authenticated
  using ((select public.has_manage_role()))
  with check ((select public.has_manage_role()));

-- profiles
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_manage_admin
  on public.profiles for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- product_categories
create policy product_categories_select_authenticated
  on public.product_categories for select
  to authenticated
  using (true);

create policy product_categories_write_manage
  on public.product_categories for all
  to authenticated
  using ((select public.has_manage_role()))
  with check ((select public.has_manage_role()));

-- products
create policy products_select_authenticated
  on public.products for select
  to authenticated
  using (true);

create policy products_write_manage
  on public.products for insert
  to authenticated
  with check ((select public.has_manage_role()));

create policy products_update_manage
  on public.products for update
  to authenticated
  using ((select public.has_manage_role()))
  with check ((select public.has_manage_role()));

-- stock_movements: select all authenticated; insert for write roles; no update/delete
create policy stock_movements_select_authenticated
  on public.stock_movements for select
  to authenticated
  using (true);

create policy stock_movements_insert_write
  on public.stock_movements for insert
  to authenticated
  with check ((select public.has_write_role()));

-- ---------------------------------------------------------------------------
-- Grants (Data API)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select on public.departments, public.profiles, public.product_categories,
  public.products, public.stock_movements to authenticated;
grant select on public.v_products_low_stock, public.v_products_stock_status to authenticated;

grant insert, update, delete on public.departments to authenticated;
grant update on public.profiles to authenticated;
grant insert, update, delete on public.product_categories to authenticated;
grant insert, update on public.products to authenticated;
grant insert on public.stock_movements to authenticated;

-- ---------------------------------------------------------------------------
-- Seed data (demo Hotel Demo)
-- ---------------------------------------------------------------------------
insert into public.departments (code, name) values
  ('AMA', 'Ama de Llaves'),
  ('LAV', 'Lavandería'),
  ('MTO', 'Mantenimiento');

insert into public.product_categories (code, name) values
  ('AMEN', 'Amenidades'),
  ('BLAN', 'Blancos'),
  ('QUIM', 'Químicos'),
  ('INSU', 'Insumos');

insert into public.products (code, name, category_id, unit, quantity_on_hand, min_stock)
select 'AM-001', 'Jabón de tocador', id, 'unidad', 0, 100
from public.product_categories where code = 'AMEN'
union all
select 'AM-002', 'Shampoo', id, 'unidad', 0, 80
from public.product_categories where code = 'AMEN'
union all
select 'BL-001', 'Toalla de cuerpo', id, 'unidad', 0, 100
from public.product_categories where code = 'BLAN'
union all
select 'BL-002', 'Sábana matrimonial', id, 'unidad', 0, 80
from public.product_categories where code = 'BLAN'
union all
select 'QU-001', 'Detergente', id, 'litro', 0, 50
from public.product_categories where code = 'QUIM'
union all
select 'IN-001', 'Guantes', id, 'caja', 0, 10
from public.product_categories where code = 'INSU'
union all
select 'IN-002', 'Bolsas de basura', id, 'paquete', 0, 15
from public.product_categories where code = 'INSU';

-- Opening stock via kardex (trigger updates quantity_on_hand)
insert into public.stock_movements (product_id, movement_type, quantity, reason, notes)
select id, 'in', 250, 'Inventario inicial', 'Seed MVP'
from public.products where code = 'AM-001';

insert into public.stock_movements (product_id, movement_type, quantity, reason, notes)
select id, 'in', 200, 'Inventario inicial', 'Seed MVP'
from public.products where code = 'AM-002';

insert into public.stock_movements (product_id, movement_type, quantity, reason, notes)
select id, 'in', 180, 'Inventario inicial', 'Seed MVP'
from public.products where code = 'BL-001';

insert into public.stock_movements (product_id, movement_type, quantity, reason, notes)
select id, 'in', 150, 'Inventario inicial', 'Seed MVP'
from public.products where code = 'BL-002';

insert into public.stock_movements (product_id, movement_type, quantity, reason, notes)
select id, 'in', 35, 'Inventario inicial', 'Seed MVP'
from public.products where code = 'QU-001';

insert into public.stock_movements (product_id, movement_type, quantity, reason, notes)
select id, 'in', 8, 'Inventario inicial', 'Seed MVP'
from public.products where code = 'IN-001';

insert into public.stock_movements (product_id, movement_type, quantity, reason, notes)
select id, 'in', 3, 'Inventario inicial', 'Seed MVP'
from public.products where code = 'IN-002';
