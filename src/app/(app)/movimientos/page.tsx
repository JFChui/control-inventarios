import { MovementForm } from "@/components/movements/movement-form";
import { PageHeader } from "@/components/ui/page-header";
import { canWriteMovements } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format/datetime";
import { createClient } from "@/lib/supabase/server";

export default async function MovimientosPage() {
  const { profile } = await requireModule("movimientos");
  const supabase = await createClient();
  const canWrite = canWriteMovements(profile?.role);

  const [{ data: products }, { data: departments }, { data: categories }, { data: movements }, { data: recStock }, { data: recLoc }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, code, name, quantity_on_hand, category_id, product_categories(code)")
        .eq("is_active", true)
        .order("code"),
      supabase.from("departments").select("id, code, name").order("code"),
      supabase.from("product_categories").select("id, code, name").order("code"),
      supabase
        .from("stock_movements")
        .select(
          "id, movement_type, quantity, occurred_at, reason, supplier, products(code, name)",
        )
        .order("occurred_at", { ascending: false })
        .limit(30),
      supabase.from("reception_linner_stock").select("product_id, quantity, max_qty"),
      supabase.from("storage_locations").select("id").eq("code", "REC").maybeSingle(),
    ]);

  const { data: linenAtRec } = recLoc
    ? await supabase
        .from("linen_location_stock")
        .select("quantity, linen_items(product_id)")
        .eq("location_id", recLoc.id)
    : { data: [] as { quantity: number; linen_items: { product_id: string } | { product_id: string }[] | null }[] };

  const recQty = new Map<string, number>();
  for (const row of linenAtRec ?? []) {
    const linen = Array.isArray(row.linen_items) ? row.linen_items[0] : row.linen_items;
    if (!linen?.product_id) continue;
    recQty.set(linen.product_id, (recQty.get(linen.product_id) ?? 0) + Number(row.quantity));
  }
  const recLimits = new Map(
    (recStock ?? []).map((row) => [
      row.product_id,
      { qty: Number(row.quantity), max: Number(row.max_qty) },
    ]),
  );
  const receptionHints = (products ?? []).map((p) => {
    const category = Array.isArray(p.product_categories)
      ? p.product_categories[0]
      : p.product_categories;
    const lim = recLimits.get(p.id) ?? { qty: 0, max: 0 };
    const qty = category?.code === "BLAN" ? (recQty.get(p.id) ?? 0) : lim.qty;
    return { productId: p.id, toBring: Math.max(0, lim.max - qty) };
  });

  const rows = (movements ?? []).map((m) => {
    const product = Array.isArray(m.products) ? m.products[0] : m.products;
    return { m, product };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Entradas y salidas"
        description="Cada movimiento actualiza el kardex y la existencia automáticamente."
      />

      {canWrite ? (
        <MovementForm
          products={(products ?? []).map((p) => ({
            ...p,
            quantity_on_hand: Number(p.quantity_on_hand),
          }))}
          departments={departments ?? []}
          categories={categories ?? []}
          lockDepartmentId={
            profile?.role === "department_user" ? profile.department_id : null
          }
          receptionHints={receptionHints}
        />
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tu rol es solo lectura. No puedes registrar movimientos.
        </p>
      )}

      <div>
        <h2 className="text-lg font-semibold">Últimos movimientos</h2>

        <ul className="mt-3 space-y-3 md:hidden">
          {rows.map(({ m, product }) => (
            <li
              key={m.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-medium text-zinc-900">
                  {product ? product.name : "—"}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.movement_type === "in"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {m.movement_type === "in" ? "Entrada" : "Salida"}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-zinc-500">
                {product?.code ?? "—"}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-zinc-500">Cantidad</dt>
                  <dd className="tabular-nums font-medium">
                    {Number(m.quantity)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Fecha</dt>
                  <dd className="text-zinc-700">
                    {formatDateTime(m.occurred_at)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-zinc-500">Motivo</dt>
                  <dd className="text-zinc-700">
                    {m.reason ?? m.supplier ?? "—"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <div className="mt-3 hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, product }) => (
                <tr key={m.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 text-zinc-600">
                    {formatDateTime(m.occurred_at)}
                  </td>
                  <td className="px-4 py-3">
                    {m.movement_type === "in" ? "Entrada" : "Salida"}
                  </td>
                  <td className="px-4 py-3">
                    {product ? `${product.code} — ${product.name}` : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {Number(m.quantity)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {m.reason ?? m.supplier ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
