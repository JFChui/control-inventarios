import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { canManageCatalog } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format/datetime";
import { sourceTypeLabel } from "@/lib/format/labels";
import { stockBadge } from "@/lib/stock/status";
import { createClient } from "@/lib/supabase/server";

export default async function ProductKardexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ profile }, supabase] = await Promise.all([
    requireModule("inventario"),
    createClient(),
  ]);

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, code, name, unit, quantity_on_hand, min_stock, is_active, inventory_initialized_at, product_categories(code, name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const category = Array.isArray(product.product_categories)
    ? product.product_categories[0]
    : product.product_categories;

  const { data: movements } = await supabase
    .from("stock_movements")
    .select(
      "id, movement_type, quantity, occurred_at, reason, supplier, source_type, departments(code, name)",
    )
    .eq("product_id", id)
    .order("occurred_at", { ascending: false })
    .limit(100);

  const qty = Number(product.quantity_on_hand);
  const min = Number(product.min_stock);
  const badge = stockBadge(
    qty,
    min,
    Boolean(product.inventory_initialized_at),
    product.is_active,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={product.code}
        actions={
          <>
            <Link href="/inventario" className="text-sm text-zinc-500 hover:underline">
              ← Inventario
            </Link>
            {canManageCatalog(profile?.role) ? (
              <Link
                href={`/inventario/${id}/editar`}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Editar
              </Link>
            ) : null}
          </>
        }
      />

      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-500">Existencia</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {qty} {product.unit}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Stock mínimo</dt>
          <dd className="tabular-nums">{min}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Categoría</dt>
          <dd>{category ? `${category.code}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Estado</dt>
          <dd>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </dd>
        </div>
      </dl>

      <div>
        <h2 className="text-lg font-semibold">Kardex</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Historial de entradas y salidas de este producto.
        </p>

        <ul className="mt-3 space-y-3 md:hidden">
          {(movements ?? []).map((m) => {
            const dept = Array.isArray(m.departments)
              ? m.departments[0]
              : m.departments;
            return (
              <li
                key={m.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex justify-between gap-2">
                  <span
                    className={`text-xs font-medium ${
                      m.movement_type === "in"
                        ? "text-emerald-700"
                        : "text-amber-800"
                    }`}
                  >
                    {m.movement_type === "in" ? "Entrada" : "Salida"}
                  </span>
                  <span className="tabular-nums font-medium">
                    {Number(m.quantity)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDateTime(m.occurred_at)}
                </p>
                <p className="mt-2 text-sm text-zinc-700">
                  {m.reason ?? m.supplier ?? "—"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {sourceTypeLabel(m.source_type)}
                  {dept ? ` · ${dept.code}` : ""}
                </p>
              </li>
            );
          })}
          {(movements ?? []).length === 0 ? (
            <li className="text-sm text-zinc-500">Sin movimientos aún.</li>
          ) : null}
        </ul>

        <div className="mt-3 hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {(movements ?? []).map((m) => {
                const dept = Array.isArray(m.departments)
                  ? m.departments[0]
                  : m.departments;
                return (
                  <tr key={m.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 text-zinc-600">
                      {formatDateTime(m.occurred_at)}
                    </td>
                    <td className="px-4 py-3">
                      {m.movement_type === "in" ? "Entrada" : "Salida"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {Number(m.quantity)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {sourceTypeLabel(m.source_type)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {m.reason ?? m.supplier ?? "—"}
                      {dept ? ` · ${dept.name}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
