import { createClient } from "@/lib/supabase/server";

export async function LinnerRecepcionReport() {
  const supabase = await createClient();
  const [{ data: products }, { data: stock }, { data: recLocation }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, code, name, unit, product_categories(code)")
        .eq("is_active", true)
        .order("code"),
      supabase.from("reception_linner_stock").select("product_id, quantity, min_qty, max_qty"),
      supabase.from("storage_locations").select("id").eq("code", "REC").maybeSingle(),
    ]);

  const { data: linenAtRec } = recLocation
    ? await supabase
        .from("linen_location_stock")
        .select("quantity, linen_items(product_id)")
        .eq("location_id", recLocation.id)
    : { data: [] as { quantity: number; linen_items: { product_id: string } | { product_id: string }[] | null }[] };

  const recQty = new Map<string, number>();
  for (const row of linenAtRec ?? []) {
    const linen = Array.isArray(row.linen_items) ? row.linen_items[0] : row.linen_items;
    if (!linen?.product_id) continue;
    recQty.set(linen.product_id, (recQty.get(linen.product_id) ?? 0) + Number(row.quantity));
  }
  const limits = new Map(
    (stock ?? []).map((row) => [
      row.product_id,
      { qty: Number(row.quantity), min: Number(row.min_qty), max: Number(row.max_qty) },
    ]),
  );

  const rows = (products ?? []).map((p) => {
    const category = Array.isArray(p.product_categories)
      ? p.product_categories[0]
      : p.product_categories;
    const lim = limits.get(p.id) ?? { qty: 0, min: 0, max: 0 };
    const qty = category?.code === "BLAN" ? (recQty.get(p.id) ?? 0) : lim.qty;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      qty,
      min: lim.min,
      max: lim.max,
      toBring: Math.max(0, lim.max - qty),
      low: lim.min > 0 && qty < lim.min,
    };
  });

  return (
    <section>
      <h2 className="text-lg font-semibold">Stock del linner de recepción</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Existencia</th>
              <th className="px-4 py-3 font-medium">Mínimo</th>
              <th className="px-4 py-3 font-medium">Máximo</th>
              <th className="px-4 py-3 font-medium">A llevar</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 tabular-nums">
                  {row.qty} {row.unit}
                </td>
                <td className="px-4 py-3 tabular-nums">{row.min}</td>
                <td className="px-4 py-3 tabular-nums">{row.max}</td>
                <td className="px-4 py-3 tabular-nums">{row.toBring}</td>
                <td className="px-4 py-3">{row.low ? "Bajo mínimo" : "Ok"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
