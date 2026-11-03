import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { canManageCatalog } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import {
  parseInventoryFilters,
  sanitizeIlike,
} from "@/lib/catalog/filters";
import { stockBadge } from "@/lib/stock/status";
import { createClient } from "@/lib/supabase/server";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    department?: string;
    status?: string;
    activos?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters = parseInventoryFilters(sp);
  const { profile } = await requireModule("inventario");
  const supabase = await createClient();
  const manage = canManageCatalog(profile?.role);

  const [{ data: categories }, { data: departments }] = await Promise.all([
    supabase.from("product_categories").select("id, code, name").order("code"),
    supabase.from("departments").select("id, code, name").eq("is_active", true).order("code"),
  ]);

  let productQuery = supabase
    .from("products")
    .select(
      "id, code, name, unit, quantity_on_hand, min_stock, is_active, inventory_initialized_at, category_id, product_categories(code, name)",
    )
    .order("code");

  if (filters.activeOnly) {
    productQuery = productQuery.eq("is_active", true);
  }

  if (filters.category) {
    productQuery = productQuery.eq("category_id", filters.category);
  }

  const safeQ = sanitizeIlike(filters.q);
  if (safeQ) {
    productQuery = productQuery.or(
      `code.ilike.%${safeQ}%,name.ilike.%${safeQ}%`,
    );
  }

  let scopedIds: string[] | null = null;
  if (profile?.role === "department_user") {
    if (!profile.department_id) {
      scopedIds = [];
    } else {
      const { data: links } = await supabase
        .from("product_departments")
        .select("product_id")
        .eq("department_id", profile.department_id);
      scopedIds = (links ?? []).map((link) => link.product_id);
    }
  } else if (filters.department) {
    const { data: links } = await supabase
      .from("product_departments")
      .select("product_id")
      .eq("department_id", filters.department);
    scopedIds = (links ?? []).map((link) => link.product_id);
  }

  if (scopedIds) {
    productQuery = productQuery.in(
      "id",
      scopedIds.length > 0 ? scopedIds : ["00000000-0000-0000-0000-000000000000"],
    );
  }

  const { data: products } = await productQuery;

  const rows = (products ?? [])
    .map((p) => {
      const qty = Number(p.quantity_on_hand);
      const min = Number(p.min_stock);
      const badge = stockBadge(
        qty,
        min,
        Boolean(p.inventory_initialized_at),
        p.is_active,
      );
      const category = Array.isArray(p.product_categories)
        ? p.product_categories[0]
        : p.product_categories;
      return { p, qty, min, badge, category };
    })
    .filter((row) => (filters.status ? row.badge.status === filters.status : true));

  const showDepartment = profile?.role !== "department_user";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario general"
        description={`Catálogo y existencias actuales · ${rows.length} producto${rows.length === 1 ? "" : "s"}`}
        actions={
          manage ? (
            <>
              <Link
                href="/inventario/minimos"
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Mínimos y unidades
              </Link>
              <Link
                href="/inventario/nuevo"
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900"
              >
                + Nuevo producto
              </Link>
            </>
          ) : null
        }
      />

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden sm:grid-cols-2 lg:grid-cols-6"
      >
        <label className="text-sm lg:col-span-2">
          <span className="font-medium text-zinc-700">Buscar</span>
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Código o nombre"
            className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium text-zinc-700">Categoría</span>
          <select
            name="category"
            defaultValue={filters.category}
            className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="">Todas</option>
            {(categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.code} — {category.name}
              </option>
            ))}
          </select>
        </label>
        {showDepartment ? (
          <label className="text-sm">
            <span className="font-medium text-zinc-700">Departamento</span>
            <select
              name="department"
              defaultValue={filters.department}
              className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
            >
              <option value="">Todos</option>
              {(departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} — {department.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-sm">
          <span className="font-medium text-zinc-700">Estado</span>
          <select
            name="status"
            defaultValue={filters.status}
            className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="">Todos</option>
            <option value="sin_conteo">Sin conteo</option>
            <option value="agotado">Agotado</option>
            <option value="bajo">Bajo</option>
            <option value="proximo">Próximo</option>
            <option value="normal">Normal</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-zinc-700">Activos</span>
          <select
            name="activos"
            defaultValue={filters.activeOnly ? "1" : "0"}
            className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="1">Solo activos</option>
            <option value="0">Incluir inactivos</option>
          </select>
        </label>
        <div className="flex items-end gap-2 lg:col-span-6">
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900"
          >
            Filtrar
          </button>
          <Link
            href="/inventario"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Limpiar
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
          No hay productos con estos filtros.
        </p>
      ) : null}

      <ul className="space-y-3 md:hidden">
        {rows.map(({ p, qty, min, badge, category }) => (
          <li
            key={p.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/inventario/${p.id}`}
                  className="font-medium text-teal-800 hover:underline"
                >
                  {p.name}
                </Link>
                <p className="mt-0.5 font-mono text-xs text-zinc-500">{p.code}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Existencia</dt>
                <dd className="tabular-nums font-medium">
                  {qty} {p.unit}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Stock mínimo</dt>
                <dd className="tabular-nums">{min}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-zinc-500">Categoría</dt>
                <dd className="text-zinc-700">
                  {category ? `${category.code} — ${category.name}` : "—"}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
              <th className="px-4 py-3 font-medium">Existencia</th>
              <th className="px-4 py-3 font-medium">Stock mínimo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, qty, min, badge, category }) => (
              <tr key={p.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/inventario/${p.id}`}
                    className="text-teal-800 hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {category ? `${category.code}` : "—"}
                </td>
                <td className="px-4 py-3">{p.unit}</td>
                <td className="px-4 py-3 tabular-nums">{qty}</td>
                <td className="px-4 py-3 tabular-nums">{min}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
