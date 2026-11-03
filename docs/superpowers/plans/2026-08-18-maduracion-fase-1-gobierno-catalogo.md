# Maduración Fase 1 — Gobierno, catálogo y operación diaria

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar gobernanza de usuarios/roles/departamentos, catálogo editable con productos por departamento, alertas de stock en vivo e impresiones de solicitudes, sin romper el kardex ni el stock compartido.

**Architecture:** Migración incremental Postgres (enum de roles, `profiles.is_active` / `must_change_password`, `product_departments`, helpers RLS sin recursión, Realtime en `products`, entrega de solicitudes solo desde `approved`). App Next.js: capa `src/lib/auth/*` como fuente de verdad de permisos; Server Actions + RLS; isla cliente `StockAlertBubble`; ruta print CSS-only.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind 4, Supabase (Postgres + Auth + RLS + Realtime), Vitest, GitHub Actions, Vercel.

**Roadmap padre:** [2026-08-18-maduracion-roadmap.md](./2026-08-18-maduracion-roadmap.md)

## Global Constraints

- Roles DB exactos: `admin`, `mrla`, `human_resources`, `department_user` (mapear `supervisor`→`mrla`, `staff`/`readonly`→`department_user`).
- Toda mutación de existencia pasa por `stock_movements` + trigger existente; no actualizar `quantity_on_hand` a mano.
- Helpers RLS: `SECURITY DEFINER` + `set search_path = public`; nunca `EXISTS (SELECT 1 FROM profiles…)` dentro de policies de `profiles`.
- Usuarios inactivos (`is_active = false`) no leen ni escriben (RLS + Server Actions + middleware).
- `department_user` escribe solo en su `department_id` y solo productos en `product_departments`.
- Entregar solicitud exige `status = 'approved'` (ya no `pending`).
- Impresión de solicitudes: `@media print` + `window.print()`; sin dependencia PDF.
- Labels UI: “Stock mínimo” (no “mínimo” ambiguo).
- Tras cambios: commit + push `main` + verificar https://your-app.vercel.app
- Secrets solo en env; nunca commit de `.env.local`.

---

## File map (Fase 1)

| Path | Responsabilidad |
|------|-----------------|
| `supabase/migrations/20260818220000_phase1_gov_catalog_requests.sql` | Roles, profiles flags, product_departments, RLS helpers, Realtime, create/deliver request atomics |
| `src/lib/auth/roles.ts` | Tipos `AppRole`, guards de permiso |
| `src/lib/auth/session.ts` | Sesión + rechazo de inactivos / must_change_password |
| `src/lib/supabase/middleware.ts` | Redirect login / cambio password / bloqueo inactivo |
| `src/app/actions/users.ts` | CRUD usuarios (admin client create), activate, temp password |
| `src/app/actions/departments.ts` | CRUD departamentos |
| `src/app/actions/catalog.ts` | Update producto/categoría + sync product_departments |
| `src/app/actions/requests.ts` | Create atómico, filtros depto, deliver solo approved |
| `src/app/actions/auth.ts` | changePassword + clear must_change_password |
| `src/app/(app)/departamentos/*` | Módulo Departamentos |
| `src/app/(app)/usuarios/*` | Crear/editar/activar usuarios |
| `src/app/(app)/cambiar-password/page.tsx` | Cambio obligatorio |
| `src/app/(app)/solicitudes/[id]/imprimir/page.tsx` | Vista imprimible |
| `src/components/layout/stock-alert-bubble.tsx` | Contador + panel Realtime |
| `src/components/layout/app-shell.tsx` | Nav Departamentos + montar bubble |
| `src/components/catalog/*`, `movements/*`, `requests/*`, `users/*` | Formularios |
| `src/lib/stock/status.ts` | Clasificación stock (testable) |
| `tests/**/*.test.ts` | Vitest unit |
| `package.json`, `.github/workflows/ci.yml` | script `test` + CI |

---

### Task 1: Vitest harness + clasificación de stock

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/stock/status.ts`
- Create: `tests/stock-status.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nada
- Produces: `classifyStock(quantityOnHand: number, minStock: number): "agotado" | "bajo" | "proximo" | "normal"` — misma lógica que la vista SQL (`<=0` agotado; `<=min` bajo; `<=min*1.25` próximo; else normal)

- [ ] **Step 1: Añadir Vitest y script**

En `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Run: `npm install -D vitest`

- [ ] **Step 2: Config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Failing test**

```ts
// tests/stock-status.test.ts
import { describe, expect, it } from "vitest";
import { classifyStock } from "@/lib/stock/status";

describe("classifyStock", () => {
  it("agotado when qty <= 0", () => {
    expect(classifyStock(0, 10)).toBe("agotado");
  });
  it("bajo when qty <= min", () => {
    expect(classifyStock(5, 10)).toBe("bajo");
  });
  it("proximo when qty <= min * 1.25", () => {
    expect(classifyStock(12, 10)).toBe("proximo");
  });
  it("normal above threshold", () => {
    expect(classifyStock(20, 10)).toBe("normal");
  });
});
```

Run: `npm test` — Expected: FAIL module not found

- [ ] **Step 4: Implement**

```ts
// src/lib/stock/status.ts
export type StockStatus = "agotado" | "bajo" | "proximo" | "normal";

export function classifyStock(
  quantityOnHand: number,
  minStock: number,
): StockStatus {
  if (quantityOnHand <= 0) return "agotado";
  if (quantityOnHand <= minStock) return "bajo";
  if (quantityOnHand <= minStock * 1.25) return "proximo";
  return "normal";
}
```

Run: `npm test` — Expected: PASS

- [ ] **Step 5: CI**

En `.github/workflows/ci.yml`, después de `npm ci`:

```yaml
      - name: Test
        run: npm test

      - name: Lint
        run: npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/stock/status.ts tests/stock-status.test.ts .github/workflows/ci.yml
git commit -m "test: add Vitest and shared stock status classifier"
```

---

### Task 2: Migración roles, profiles flags, product_departments, helpers RLS

**Files:**
- Create: `supabase/migrations/20260818220000_phase1_gov_catalog_requests.sql`
- Modify docs later in Task 10: `docs/schema-mvp.md`, `docs/lessons-learned.md`

**Interfaces:**
- Consumes: tablas existentes `profiles`, `departments`, `products`, `supply_requests`, helpers `has_*`
- Produces:
  - enum `app_role`: `admin | mrla | human_resources | department_user`
  - `profiles.is_active boolean not null default true`
  - `profiles.must_change_password boolean not null default false`
  - `departments.is_active boolean not null default true` (si no existe)
  - table `product_departments(product_id, department_id)` PK compuesta, RLS
  - functions: `is_active_user()`, `current_app_role()`, `is_admin()`, `is_mrla()`, `is_hr()`, `is_department_user()`, `current_department_id()`, `has_manage_catalog()`, `has_write_ops()`, `has_hr_scope()`, `product_enabled_for_dept(uuid, uuid)`
  - `deliver_supply_request` exige `approved`
  - RPC `create_supply_request(...)` atómica
  - publication Realtime `products`

- [ ] **Step 1: Escribir migración completa** (un solo archivo; aplicar en remoto solo tras review local)

Fragmento crítico — remapeo de enum sin romper FKs (usar tipo nuevo + cast):

```sql
-- 1) Flags en profiles / departments
alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists must_change_password boolean not null default false;

alter table public.departments
  add column if not exists is_active boolean not null default true;

-- 2) Nuevo enum + migración de datos
create type public.app_role_v2 as enum (
  'admin', 'mrla', 'human_resources', 'department_user'
);

alter table public.profiles
  alter column role drop default;

alter table public.profiles
  add column role_v2 public.app_role_v2;

update public.profiles set role_v2 = case role::text
  when 'admin' then 'admin'::public.app_role_v2
  when 'supervisor' then 'mrla'::public.app_role_v2
  when 'staff' then 'department_user'::public.app_role_v2
  when 'readonly' then 'department_user'::public.app_role_v2
  else 'department_user'::public.app_role_v2
end;

alter table public.profiles drop column role;
alter table public.profiles rename column role_v2 to role;
alter table public.profiles
  alter column role set not null,
  alter column role set default 'department_user'::public.app_role_v2;

drop type public.app_role;
alter type public.app_role_v2 rename to app_role;

-- 3) product_departments
create table if not exists public.product_departments (
  product_id uuid not null references public.products (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, department_id)
);
create index if not exists product_departments_department_id_idx
  on public.product_departments (department_id);

alter table public.product_departments enable row level security;

-- 4) Helpers (SECURITY DEFINER, search_path = public)
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_active from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and is_active = true;
$$;

create or replace function public.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.profiles
  where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() = 'admin';
$$;

create or replace function public.is_mrla()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() = 'mrla';
$$;

create or replace function public.has_manage_catalog()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() in ('admin', 'mrla');
$$;

create or replace function public.has_write_ops()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() in ('admin', 'mrla', 'department_user');
$$;

create or replace function public.has_hr_scope()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() in ('admin', 'human_resources');
$$;

-- Compat: has_manage_role / has_write_role usados por policies existentes
create or replace function public.has_manage_role()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_manage_catalog();
$$;

create or replace function public.has_write_role()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_user() and public.has_write_ops();
$$;
```

Policies clave (reemplazar, no acumular duplicadas):

```sql
-- Ejemplo stock_movements insert: admin/mrla global; department_user solo su depto + producto habilitado
drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (
    public.is_active_user()
    and (
      public.current_app_role() in ('admin', 'mrla')
      or (
        public.current_app_role() = 'department_user'
        and department_id = public.current_department_id()
        and exists (
          select 1 from public.product_departments pd
          where pd.product_id = product_id
            and pd.department_id = public.current_department_id()
        )
      )
    )
  );
```

Entrega solo approved:

```sql
create or replace function public.deliver_supply_request(p_request_id uuid)
...
  if r.status is distinct from 'approved' then
    raise exception 'Solo se pueden entregar solicitudes aprobadas';
  end if;
...
```

RPC create atómica (insert header + lines en una función `security definer` con validación de duplicados y `product_departments`).

Realtime:

```sql
alter publication supabase_realtime add table public.products;
```

(Si ya está en la publication, envolver en bloque que ignore error duplicado.)

GRANTs: `grant select, insert, delete on product_departments to authenticated;` + revoke public en nuevas functions + `grant execute … to authenticated`.

- [ ] **Step 2: Aplicar migración**

Preferido: Supabase MCP `apply_migration` con el SQL del archivo (nombre `phase1_gov_catalog_requests`), o `npx supabase db push` si el proyecto está linkeado.

- [ ] **Step 3: Verificar**

```sql
select enumlabel from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'app_role' order by enumsortorder;
-- expected: admin, mrla, human_resources, department_user

select column_name from information_schema.columns
where table_name = 'profiles' and column_name in ('is_active','must_change_password');

select * from public.product_departments limit 1;
```

Advisors: MCP `get_advisors` — corregir RLS críticos antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260818220000_phase1_gov_catalog_requests.sql
git commit -m "db: phase1 roles, product_departments, RLS helpers, request delivery gate"
```

---

### Task 3: Auth TS — roles, sesión activa, middleware

**Files:**
- Modify: `src/lib/auth/roles.ts`
- Modify: `src/lib/auth/session.ts`
- Modify: `src/lib/supabase/middleware.ts`
- Create: `tests/roles.test.ts`

**Interfaces:**
- Consumes: columnas nuevas de `profiles`
- Produces:
  - `export type AppRole = "admin" | "mrla" | "human_resources" | "department_user"`
  - `Profile` incluye `is_active`, `must_change_password`
  - `canManageCatalog` → admin|mrla
  - `canWriteMovements` → admin|mrla|department_user (y activo)
  - `canManageUsers` → admin
  - `canManageDepartments` → admin|mrla
  - `canManageRequests` → admin|mrla
  - `canCreateRequests` → admin|mrla|department_user
  - `canManageUniforms` / HR → admin|human_resources
  - `requireActiveUser()` lanza si no autenticado o `!is_active`
  - middleware: inactivo → `/login?error=inactive`; `must_change_password` → `/cambiar-password` (excepto esa ruta y signOut)

- [ ] **Step 1: Tests de permisos**

```ts
// tests/roles.test.ts
import { describe, expect, it } from "vitest";
import { canManageCatalog, canWriteMovements, canManageUsers } from "@/lib/auth/roles";

describe("roles phase1", () => {
  it("mrla manages catalog", () => {
    expect(canManageCatalog("mrla")).toBe(true);
    expect(canManageCatalog("department_user")).toBe(false);
  });
  it("department_user can write movements", () => {
    expect(canWriteMovements("department_user")).toBe(true);
    expect(canWriteMovements("human_resources")).toBe(false);
  });
  it("only admin manages users", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("mrla")).toBe(false);
  });
});
```

Run: `npm test` — Expected: FAIL until roles.ts updated

- [ ] **Step 2: Reescribir `roles.ts`** con el mapa anterior; actualizar todos los callers que usen `"supervisor"|"staff"|"readonly"` (grep en `src/`).

- [ ] **Step 3: `session.ts`**

```ts
export async function getCurrentUserAndProfile() {
  // select id, full_name, role, department_id, is_active, must_change_password
}

export async function requireActiveUser() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) throw new Error("No autenticado");
  if (!profile?.is_active) throw new Error("Usuario desactivado");
  return { user, profile };
}
```

Reemplazar usos de `requireUser` en actions de escritura por `requireActiveUser` (o hacer que `requireUser` exija activo).

- [ ] **Step 4: Middleware**

Tras `getUser()`, si hay user, leer profile (o claims) y:

```ts
if (profile && profile.is_active === false) {
  // sign out cookies opcional; redirect /login?error=inactive
}
if (
  profile?.must_change_password &&
  pathname !== "/cambiar-password" &&
  !pathname.startsWith("/login")
) {
  url.pathname = "/cambiar-password";
  return NextResponse.redirect(url);
}
```

Nota: el middleware hoy no consulta `profiles`; añadir query ligera con el mismo client SSR. Si falla por RLS, el helper `is_active_user` + policy select debe permitir al usuario leer su propia fila.

- [ ] **Step 5: Run tests + commit**

```bash
npm test
git add src/lib/auth tests/roles.test.ts src/lib/supabase/middleware.ts
git commit -m "feat: phase1 app roles and active-session gates"
```

---

### Task 4: Módulo Departamentos

**Files:**
- Create: `src/app/actions/departments.ts`
- Create: `src/app/(app)/departamentos/page.tsx`
- Create: `src/components/departments/department-form.tsx`
- Modify: `src/components/layout/app-shell.tsx` — link Admin/Inventario: `/departamentos` visible a `canManageDepartments`

**Interfaces:**
- Consumes: `canManageDepartments`, tabla `departments`
- Produces:
  - `createDepartment(formData)` → `{code, name}` uppercase code
  - `updateDepartment(formData)` → id, code, name, is_active
  - `deactivateDepartment(id)` si hay FKs; `deleteDepartment(id)` solo sin referencias (movimientos, profiles, product_departments, supply_requests)

- [ ] **Step 1: Actions**

Validar unicidad de `code`. En delete: si error FK, devolver mensaje en español pidiendo desactivar.

- [ ] **Step 2: Page lista + forms** (patrón visual de `/categorias` y `/usuarios`: lista + formularios bordered).

- [ ] **Step 3: Nav** en `app-shell.tsx`:

```ts
{ href: "/departamentos", label: "Departamentos", manageOnly: true },
```

Ajustar filtro `manageOnly` para usar `canManageDepartments` / `canManageCatalog` (mrla+admin), no solo admin.

- [ ] **Step 4: Manual smoke** — crear depto, editar, desactivar.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/departments.ts src/app/\(app\)/departamentos src/components/departments src/components/layout/app-shell.tsx
git commit -m "feat: departments module with soft-deactivate"
```

---

### Task 5: Usuarios — crear, editar, activar, password temporal

**Files:**
- Modify: `src/app/actions/users.ts`
- Modify: `src/app/(app)/usuarios/page.tsx`
- Modify: `src/components/users/profile-edit-form.tsx`
- Create: `src/components/users/create-user-form.tsx`
- Create: `src/app/(app)/cambiar-password/page.tsx`
- Create: `src/components/users/change-password-form.tsx`
- Modify: `src/app/actions/auth.ts`

**Interfaces:**
- Consumes: `createAdminClient()`, `canManageUsers`
- Produces:
  - `createUser`: email + full_name + role + department_id + temp password; `auth.admin.createUser({ email, password, email_confirm: true })` luego update profile `must_change_password=true`, `is_active=true`; devolver password en `ActionState.tempPassword` **solo en esa respuesta**
  - `updateProfile`: role, department, full_name, is_active
  - `changeOwnPassword`: `supabase.auth.updateUser({ password })` + `profiles.must_change_password = false`

- [ ] **Step 1: `createUser` action**

```ts
const admin = createAdminClient();
const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
const { data, error } = await admin.auth.admin.createUser({
  email,
  password: tempPassword,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});
// trigger handle_new_user ya inserta profile — luego:
await admin.from("profiles").update({
  full_name: fullName,
  role,
  department_id: departmentId,
  must_change_password: true,
  is_active: true,
}).eq("id", data.user.id);
return { success: "Usuario creado.", tempPassword };
```

- [ ] **Step 2: UI create + mostrar temp password una vez** (alert/copy; no persistir en DB).

- [ ] **Step 3: Edit form** — selects de roles nuevos + checkbox Activo.

- [ ] **Step 4: `/cambiar-password`** — form mínimo; tras éxito `redirect("/")`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: admin user provisioning and forced password change"
```

---

### Task 6: Catálogo editable + product_departments + filtro movimientos

**Files:**
- Modify: `src/app/actions/catalog.ts` — `updateProduct`, `updateCategory`, sync departments
- Modify: `src/components/catalog/product-form.tsx` — modo create/edit + multi-select departamentos
- Create: `src/app/(app)/inventario/[id]/editar/page.tsx`
- Modify: `src/app/(app)/inventario/[id]/page.tsx` — link Editar
- Modify: `src/app/(app)/categorias/page.tsx` + `category-form.tsx` — editar code/name
- Modify: `src/components/movements/movement-form.tsx` — filtro por categoría
- Modify: `src/app/actions/movements.ts` — validar producto habilitado para depto del usuario si `department_user`
- Create: `tests/product-department-guard.test.ts` (función pura de validación si se extrae)

**Interfaces:**
- Consumes: `product_departments`, `has_manage_catalog`
- Produces:
  - `updateProduct({ id, code, name, category_id, unit, min_stock, is_active, department_ids: string[] })`
  - Sync: delete rows no listadas + insert faltantes (en action, con manage role)
  - Label UI: “Stock mínimo”

- [ ] **Step 1: `updateCategory` / `updateProduct`** con unicidad y revalidate paths `/inventario`, `/categorias`, `/alertas`, `/`.

- [ ] **Step 2: Form producto** acepta `initial` + `departments: {id,code,name}[]` + checkboxes `department_ids`.

- [ ] **Step 3: Página editar** carga producto + product_departments.

- [ ] **Step 4: Movement form** — select categoría filtra productos client-side; server valida stock y permisos.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: editable catalog and per-department product enablement"
```

---

### Task 7: StockAlertBubble (Realtime)

**Files:**
- Create: `src/components/layout/stock-alert-bubble.tsx`
- Modify: `src/components/layout/app-shell.tsx` — render bubble cuando hay sesión
- Modify: `src/app/(app)/alertas/page.tsx` — label “Stock mínimo”

**Interfaces:**
- Consumes: `v_products_low_stock`, Realtime `postgres_changes` on `products`
- Produces: cliente que:
  1. fetch inicial low stock
  2. subscribe `table: products` → refetch view o recalcular con `classifyStock`
  3. botón flotante con contador; panel con lista + links `/alertas` y `/inventario/[id]`

- [ ] **Step 1: Componente cliente**

```tsx
"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Low = { id: string; code: string; name: string; quantity_on_hand: number; min_stock: number; stock_status: string };

export function StockAlertBubble() {
  const [items, setItems] = useState<Low[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("v_products_low_stock")
      .select("id, code, name, quantity_on_hand, min_stock, stock_status")
      .order("quantity_on_hand");
    setItems((data as Low[]) ?? []);
  }

  useEffect(() => {
    void load();
    const supabase = createClient();
    const channel = supabase
      .channel("products-stock-alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  // UI: fixed bottom-right button + panel
}
```

- [ ] **Step 2: Montar en shell** (fuera del drawer, z-index alto).

- [ ] **Step 3: Smoke** — bajar stock con salida y ver contador actualizar sin reload completo.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: realtime low-stock alert bubble in app shell"
```

---

### Task 8: Solicitudes robustas + imprimir

**Files:**
- Modify: `src/app/actions/requests.ts` — usar RPC `create_supply_request` si existe; forzar department del profile para `department_user`; validar productos habilitados; `deliverRequest` deja que SQL exija approved
- Modify: `src/components/requests/request-form.tsx` — depto fijo, productos filtrados, disable ya elegidos, más de 3 líneas si el PDF lo pide (mínimo 5–10)
- Modify: `src/components/requests/request-manage-panel.tsx` — mostrar solicitante / revisor / entregador
- Modify: `src/app/(app)/solicitudes/page.tsx` — joins a profiles
- Create: `src/app/(app)/solicitudes/[id]/imprimir/page.tsx`
- Create: `src/components/requests/request-print-view.tsx`

**Interfaces:**
- Consumes: `product_departments`, `deliver_supply_request` gated
- Produces: flujo Pendiente → Aprobada/Rechazada → Entregada; print page

- [ ] **Step 1: createRequest**

```ts
if (profile.role === "department_user") {
  if (!profile.department_id) return { error: "Tu usuario no tiene departamento." };
  departmentId = profile.department_id;
}
// validate each product_id in product_departments for departmentId
// call rpc create_supply_request or keep insert+lines inside a single postgres function
```

- [ ] **Step 2: UI form** — hidden input department_id cuando department_user; select productos filtrados; al elegir uno, quitarlo de otros selects.

- [ ] **Step 3: Page imprimir** (Server Component) carga request + lines + nombres; botón cliente:

```tsx
"use client";
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="… print:hidden">
      Imprimir
    </button>
  );
}
```

CSS: `@media print { .print\\:hidden { display: none } }` / ocultar shell vía clase en layout de esa ruta o `print:hidden` en nav.

Opción limpia: layout segment `solicitudes/[id]/imprimir/layout.tsx` sin shell — o página full-bleed y `print:hidden` en AppShell (ya es cliente: detectar pathname).

- [ ] **Step 4: Manual** — crear → aprobar → entregar (rechazar deliver desde pending debe fallar); imprimir.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: departmental supply requests with print view"
```

---

### Task 9: Pruebas SQL/RLS (checklist documentada + scripts)

**Files:**
- Create: `docs/qa/phase1-rls-checklist.md`
- Create: `supabase/tests/phase1_rls.sql` (opcional, ejecutable en SQL Editor)

**Interfaces:**
- Produce checklist reproducible:

1. Usuario inactivo: select/insert fallan.
2. `department_user` no inserta movimiento de otro depto.
3. `department_user` no usa producto no habilitado.
4. `deliver_supply_request` en `pending` → error.
5. Doble deliver → error idempotente.
6. Admin crea categoría; `department_user` no.

- [ ] **Step 1: Escribir SQL de prueba** con `set local role authenticated` + `request.jwt.claim.sub` si el entorno lo permite; si no, documentar pruebas manuales con 3 usuarios seed.

- [ ] **Step 2: Ejecutar checklist** y anotar resultados en el mismo doc.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: phase1 RLS and request delivery QA checklist"
```

---

### Task 10: Docs de producto + ship Fase 1

**Files:**
- Modify: `docs/product-spec.md` — roles, departamentos, product enablement, alertas live, print
- Modify: `docs/manual-usuario.md` (si existe; si no, crear secciones mínimas)
- Modify: `docs/schema-mvp.md` — nuevos roles/tablas
- Modify: `docs/lessons-learned.md` — mapeo roles + no recursión RLS
- Modify: `.cursor/skills/project-lessons/SKILL.md` — permissions map actualizado

- [x] **Step 1: Actualizar docs** alineados al comportamiento real shippeado.

- [x] **Step 2: Verificación local**

```bash
npm test
npm run lint
npm run build
```

Expected: all green.

- [x] **Step 3: Push y smoke prod** — push de `feat/phase1-maduracion` (no `main`). Smoke **prod pendiente** hasta merge.

```bash
git push origin HEAD
```

Smoke (deferred until merge):
1. `/login` 200
2. Admin ve Departamentos/Usuarios
3. Crear producto con departamentos
4. Solicitud department_user → aprobar → entregar → stock baja
5. Bubble muestra alerta si bajo mínimo
6. `/solicitudes/[id]/imprimir` imprime

- [x] **Step 4: Marcar Fase 1 done** en roadmap (`Listo para merge`); no iniciar Fase 2 hasta smoke OK.

---

## Out of scope (Fase 1)

- Blancos / inventario físico / dotación / uniformes / maquinaria (Fases 2–3)
- Dashboard/estadísticas avanzadas (Fase 4)
- PDF libraries
- Cambio de Vercel project o secrets

## Self-review (plan vs maduración Cursor)

| Requisito plan Cursor Fase 1 | Task |
|------------------------------|------|
| Migración roles + is_active + must_change_password | Task 2 |
| product_departments + RLS helpers | Task 2 |
| Realtime products | Task 2 + 7 |
| Solicitudes atómicas + approved before deliver | Task 2 + 8 |
| roles.ts / session.ts | Task 3 |
| Usuarios + temp password + cambiar password | Task 5 |
| Módulo /departamentos | Task 4 |
| Editar catálogo + categorías + filtro movimientos | Task 6 |
| StockAlertBubble + label Stock mínimo | Task 7 |
| Solicitudes UI + imprimir | Task 8 |
| Vitest + CI + docs + ship | Tasks 1, 9, 10 |
