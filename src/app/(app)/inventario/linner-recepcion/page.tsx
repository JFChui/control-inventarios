import {
  ConsumeReceptionForm,
  SetReceptionLimitsForm,
} from "@/components/reception/reception-forms";
import { PageHeader } from "@/components/ui/page-header";
import { canManageReceptionLimits } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function LinnerRecepcionPage() {
  const { profile } = await requireModule("linner_recepcion");
  const supabase = await createClient();
  const canLimits = canManageReceptionLimits(profile?.role);

  const [{ data: products }, { data: stock }, { data: recLocation }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, code, name, unit, product_categories(code)")
        .eq("is_active", true)
        .order("code"),
      supabase
        .from("reception_linner_stock")
        .select("product_id, quantity, min_qty, max_qty"),
      supabase
        .from("storage_locations")
        .select("id")
        .eq("code", "REC")
        .maybeSingle(),
    ]);

  const { data: linenAtRec } = recLocation
    ? await supabase
        .from("linen_location_stock")
        .select("quantity, linen_items(product_id)")
        .eq("location_id", recLocation.id)
    : { data: [] as { quantity: number; linen_items: { product_id: string } | { product_id: string }[] | null }[] };

  const recQtyByProduct = new Map<string, number>();
  for (const row of linenAtRec ?? []) {
    const linen = Array.isArray(row.linen_items) ? row.linen_items[0] : row.linen_items;
    if (!linen?.product_id) continue;
    recQtyByProduct.set(
      linen.product_id,
      (recQtyByProduct.get(linen.product_id) ?? 0) + Number(row.quantity),
    );
  }

  const limits = new Map(
    (stock ?? []).map((row) => [
      row.product_id,
      {
        quantity: Number(row.quantity),
        min: Number(row.min_qty),
        max: Number(row.max_qty),
      },
    ]),
  );

  const rows = (products ?? []).map((p) => {
    const category = Array.isArray(p.product_categories)
      ? p.product_categories[0]
      : p.product_categories;
    const isLinen = category?.code === "BLAN";
    const lim = limits.get(p.id) ?? { quantity: 0, min: 0, max: 0 };
    const qty = isLinen ? (recQtyByProduct.get(p.id) ?? 0) : lim.quantity;
    const toBring = Math.max(0, lim.max - qty);
    const low = lim.min > 0 && qty < lim.min;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      isLinen,
      qty,
      min: lim.min,
      max: lim.max,
      toBring,
      low,
    };
  });

  const options = rows.map((row) => ({
    id: row.id,
    label: `${row.code} — ${row.name}`,
  }));
  const consumeOptions = rows
    .filter((row) => !row.isLinen)
    .map((row) => ({
      id: row.id,
      label: `${row.code} — ${row.name}`,
    }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stock del linner de recepción"
        description="Mínimo y máximo de cada producto que debe tener el linner de recepción. Las salidas hacia este linner se registran en Entradas y salidas."
      />

      {canLimits ? <SetReceptionLimitsForm products={options} /> : null}
      <ConsumeReceptionForm products={consumeOptions} />

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Existencia linner</th>
              <th className="px-4 py-3 font-medium">Mínimo</th>
              <th className="px-4 py-3 font-medium">Máximo</th>
              <th className="px-4 py-3 font-medium">A llevar</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-t border-zinc-100 ${row.low ? "bg-amber-50" : ""}`}
              >
                <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                <td className="px-4 py-3 font-medium">
                  {row.name}
                  {row.isLinen ? (
                    <span className="mt-1 block text-xs font-normal text-zinc-500">
                      Blanco · se surte desde Control de blancos
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {row.qty} {row.unit}
                </td>
                <td className="px-4 py-3 tabular-nums">{row.min}</td>
                <td className="px-4 py-3 tabular-nums">{row.max}</td>
                <td className="px-4 py-3 tabular-nums">{row.toBring}</td>
                <td className="px-4 py-3">
                  {row.low ? "Bajo mínimo" : "Ok"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
