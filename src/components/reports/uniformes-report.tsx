import { createClient } from "@/lib/supabase/server";
import {
  EMPLOYMENT_LABELS,
  formatWorkerDisplayName,
  type EmploymentType,
} from "@/lib/uniforms/workers";

export async function UniformesReport() {
  const supabase = await createClient();
  const [{ data: skus }, { data: assignments }] = await Promise.all([
    supabase
      .from("uniform_skus")
      .select("id, code, name, size, total, available, in_use, unusable")
      .order("code"),
    supabase
      .from("uniform_assignments")
      .select(
        "id, sku_id, quantity, worker_name, uniform_workers(uniform_code, last_name, first_name, employment_type)",
      )
      .is("returned_at", null)
      .order("assigned_at"),
  ]);

  const groups = new Map<string, { fijo: number; eventual: number }>();
  const detail = new Map<string, { label: string; type: string; qty: number }[]>();
  for (const a of assignments ?? []) {
    const roster = Array.isArray(a.uniform_workers)
      ? a.uniform_workers[0]
      : a.uniform_workers;
    const type = roster?.employment_type === "eventual" ? "eventual" : "fijo";
    const prev = groups.get(a.sku_id) ?? { fijo: 0, eventual: 0 };
    prev[type] += Number(a.quantity);
    groups.set(a.sku_id, prev);
    const list = detail.get(a.sku_id) ?? [];
    list.push({
      label: roster ? formatWorkerDisplayName(roster) : a.worker_name,
      type,
      qty: Number(a.quantity),
    });
    detail.set(a.sku_id, list);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">Uniformes de fijos, eventuales, RR.HH. y no utilizables</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Prenda</th>
              <th className="px-4 py-3 font-medium">Fijos</th>
              <th className="px-4 py-3 font-medium">Eventuales</th>
              <th className="px-4 py-3 font-medium">RR.HH.</th>
              <th className="px-4 py-3 font-medium">No utilizables</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Asignados</th>
            </tr>
          </thead>
          <tbody>
            {(skus ?? []).map((s) => (
              <tr key={s.id} className="border-t border-zinc-100 align-top">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-zinc-500">{s.code}</span>{" "}
                  {s.name} ({s.size})
                </td>
                <td className="px-4 py-3 tabular-nums">{groups.get(s.id)?.fijo ?? 0}</td>
                <td className="px-4 py-3 tabular-nums">{groups.get(s.id)?.eventual ?? 0}</td>
                <td className="px-4 py-3 tabular-nums">{Number(s.available)}</td>
                <td className="px-4 py-3 tabular-nums">{Number(s.unusable)}</td>
                <td className="px-4 py-3 tabular-nums">{Number(s.total)}</td>
                <td className="px-4 py-3 text-xs text-zinc-600">
                  {(detail.get(s.id) ?? [])
                    .map(
                      (row) =>
                        `${row.label} × ${row.qty} (${EMPLOYMENT_LABELS[row.type as EmploymentType] ?? row.type})`,
                    )
                    .join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
