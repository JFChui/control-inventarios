import { createClient } from "@/lib/supabase/server";
import { SERVICE_LABELS, type ServiceType } from "@/lib/maid/preview";

export async function DotacionReport({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const supabase = await createClient();
  const { data: allocations } = await supabase
    .from("maid_allocations")
    .select(
      "id, maid_name, shift, allocation_date, status, revision_count, maid_allocation_counts(room_type, service_type, room_count)",
    )
    .eq("status", "confirmed")
    .gte("allocation_date", from)
    .lte("allocation_date", to)
    .order("allocation_date", { ascending: false });

  const ids = (allocations ?? []).map((a) => a.id);
  const { data: movements } = ids.length
    ? await supabase
        .from("stock_movements")
        .select("source_id, product_id, movement_type, quantity, products(code, name)")
        .eq("source_type", "maid_allocation")
        .in("source_id", ids)
    : { data: [] as never[] };

  const delivered = new Map<string, { code: string; name: string; qty: number }[]>();
  for (const m of movements ?? []) {
    if (!m.source_id) continue;
    const product = Array.isArray(m.products) ? m.products[0] : m.products;
    const signed = m.movement_type === "out" ? Number(m.quantity) : -Number(m.quantity);
    const list = delivered.get(m.source_id) ?? [];
    const existing = list.find((row) => row.code === (product?.code ?? m.product_id));
    if (existing) existing.qty += signed;
    else {
      list.push({
        code: product?.code ?? m.product_id,
        name: product?.name ?? "Producto",
        qty: signed,
      });
    }
    delivered.set(m.source_id, list);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">
        Dotación camarera · {from} a {to}
      </h2>
      {(allocations ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No hay dotaciones confirmadas en ese rango.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {(allocations ?? []).map((a) => (
            <li key={a.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="font-medium">{a.maid_name}</p>
              <p className="text-sm text-zinc-600">
                {a.allocation_date}
                {a.shift ? ` · ${a.shift}` : ""}
                {a.revision_count > 0 ? ` · rectificada ${a.revision_count}` : ""}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Habitaciones:{" "}
                {(a.maid_allocation_counts ?? [])
                  .map(
                    (c) =>
                      `${c.room_type} ${SERVICE_LABELS[c.service_type as ServiceType] ?? c.service_type}: ${c.room_count}`,
                  )
                  .join(" · ") || "—"}
              </p>
              <table className="mt-3 min-w-full text-left text-sm">
                <thead className="text-zinc-600">
                  <tr>
                    <th className="py-1 font-medium">Producto</th>
                    <th className="py-1 font-medium">Cantidad entregada</th>
                  </tr>
                </thead>
                <tbody>
                  {(delivered.get(a.id) ?? [])
                    .filter((row) => row.qty !== 0)
                    .map((row) => (
                      <tr key={row.code} className="border-t border-zinc-100">
                        <td className="py-1">
                          <span className="font-mono text-xs text-zinc-500">{row.code}</span>{" "}
                          {row.name}
                        </td>
                        <td className="py-1 tabular-nums">{row.qty}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
