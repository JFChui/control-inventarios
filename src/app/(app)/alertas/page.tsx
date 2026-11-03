import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessModule } from "@/lib/auth/modules";
import { requireModule } from "@/lib/auth/session";
import { STOCK_STATUS_UI, type StockStatus } from "@/lib/stock/status";
import { createClient } from "@/lib/supabase/server";
import { sanitizeIlike } from "@/lib/catalog/filters";

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { profile } = await requireModule("alertas");
  const supabase = await createClient();
  let query = supabase
    .from("v_products_low_stock")
    .select("id, code, name, unit, quantity_on_hand, min_stock, stock_status")
    .order("quantity_on_hand");

  const safeQ = sanitizeIlike(q);
  if (safeQ) {
    query = query.or(`code.ilike.%${safeQ}%,name.ilike.%${safeQ}%`);
  }

  const { data: lowStock } = await query;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas de bajo stock"
        description="Productos inicializados en o por debajo del stock mínimo. Los que aún no se han contado no aparecen aquí."
        actions={
          canAccessModule(profile.role, "movimientos") ? (
            <Link
              href="/movimientos"
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Registrar movimiento
            </Link>
          ) : null
        }
      />

      <form method="get" className="flex flex-wrap gap-2 print:hidden">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar código o nombre"
          className="min-h-10 min-w-56 flex-1 rounded-md border border-zinc-300 px-3 text-sm"
        />
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-md bg-teal-800 px-3 text-sm font-medium text-white hover:bg-teal-900"
        >
          Buscar
        </button>
      </form>

      {(lowStock ?? []).length === 0 ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          No hay productos en alerta de stock. Los ítems sin conteo inicial no
          generan alerta.
        </p>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {(lowStock ?? []).map((p) => {
              const status = p.stock_status as StockStatus;
              const badge = STOCK_STATUS_UI[status] ?? STOCK_STATUS_UI.bajo;
              return (
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
                      <p className="mt-0.5 font-mono text-xs text-zinc-500">
                        {p.code}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-zinc-500">Existencia</dt>
                      <dd className="tabular-nums font-medium">
                        {Number(p.quantity_on_hand)} {p.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">Stock mínimo</dt>
                      <dd className="tabular-nums">{Number(p.min_stock)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Existencia</th>
                  <th className="px-4 py-3 font-medium">Stock mínimo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(lowStock ?? []).map((p) => {
                  const status = p.stock_status as StockStatus;
                  const badge = STOCK_STATUS_UI[status] ?? STOCK_STATUS_UI.bajo;
                  return (
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
                      <td className="px-4 py-3 tabular-nums">
                        {Number(p.quantity_on_hand)} {p.unit}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {Number(p.min_stock)}
                      </td>
                      <td className="px-4 py-3">{badge.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
