import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CountLinesPanel,
  CreateCountButton,
  PostCountButton,
} from "@/components/physical/count-controls";
import { PageHeader } from "@/components/ui/page-header";
import {
  canManagePhysicalCount,
  canWritePhysicalCount,
} from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { classifyCountVariance } from "@/lib/physical/variance";
import { formatDateTime } from "@/lib/format/datetime";
import { createClient } from "@/lib/supabase/server";

export default async function InventarioFisicoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const { profile } = await requireModule("inventario_fisico");
  const supabase = await createClient();
  const canWrite = canWritePhysicalCount(profile?.role);
  const canPost = canManagePhysicalCount(profile?.role);

  const [{ data: counts }, { data: departments }] = await Promise.all([
    supabase
      .from("physical_counts")
      .select("id, counted_at, status, notes, posted_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("departments")
      .select("id, code, name")
      .eq("is_active", true)
      .order("code"),
  ]);

  let detail: {
    count: {
      id: string;
      counted_at: string;
      status: string;
      notes: string | null;
    };
    lines: {
      id: string;
      system_qty: number;
      counted_qty: number | null;
      product_label: string;
      classification: ReturnType<typeof classifyCountVariance>;
    }[];
  } | null = null;

  if (id) {
    const { data: count } = await supabase
      .from("physical_counts")
      .select("id, counted_at, status, notes")
      .eq("id", id)
      .maybeSingle();

    if (!count) {
      notFound();
    }
    if (count) {
      const { data: lines } = await supabase
        .from("physical_count_lines")
        .select(
          "id, system_qty, counted_qty, products(code, name)",
        )
        .eq("count_id", id)
        .order("created_at");

      detail = {
        count,
        lines: (lines ?? []).map((line) => {
          const product = Array.isArray(line.products)
            ? line.products[0]
            : line.products;
          const system = Number(line.system_qty);
          const counted =
            line.counted_qty == null ? null : Number(line.counted_qty);
          return {
            id: line.id,
            system_qty: system,
            counted_qty: counted,
            product_label: product
              ? `${product.code} — ${product.name}`
              : "—",
            classification: classifyCountVariance(system, counted),
          };
        }),
      };
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inventario físico"
        description="Compara existencia del sistema vs. conteo real. Si el sistema está en 0, este conteo carga la existencia inicial."
        actions={
          canWrite ? (
            <CreateCountButton
              departments={departments ?? []}
              lockDepartment={profile?.role === "department_user"}
            />
          ) : null
        }
      />

      <div>
        <h2 className="text-lg font-semibold">Conteos</h2>

        <ul className="mt-3 space-y-3 md:hidden">
          {(counts ?? []).map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/inventario-fisico?id=${c.id}`}
                    className="font-medium text-teal-800 hover:underline"
                  >
                    {c.counted_at}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatDateTime(c.created_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.status === "posted"
                      ? "bg-teal-50 text-teal-900"
                      : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {c.status === "posted" ? "Cerrado" : "Borrador"}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha conteo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Creado</th>
                <th className="px-4 py-3 font-medium">Cerrado</th>
              </tr>
            </thead>
            <tbody>
              {(counts ?? []).map((c) => (
                <tr key={c.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <Link
                      href={`/inventario-fisico?id=${c.id}`}
                      className="font-medium text-teal-800 hover:underline"
                    >
                      {c.counted_at}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "posted"
                          ? "bg-teal-50 text-teal-900"
                          : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {c.status === "posted" ? "Cerrado" : "Borrador"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatDateTime(c.created_at)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {c.posted_at
                      ? formatDateTime(c.posted_at)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Detalle — {detail.count.counted_at}
              </h2>
              <p className="text-sm text-zinc-600">
                Estado:{" "}
                {detail.count.status === "posted" ? "Cerrado" : "Borrador"}
                {" · "}
                Progreso:{" "}
                {
                  detail.lines.filter((line) => line.counted_qty != null)
                    .length
                }
                /{detail.lines.length} contadas
              </p>
              {detail.lines.some((line) => line.system_qty === 0) ? (
                <p className="mt-1 text-sm text-teal-900">
                  Hay líneas con existencia 0: el cierre las trata como
                  apertura de inventario (motivo «Apertura inventario físico»).
                </p>
              ) : null}
              <p className="text-xs text-zinc-500">
                Diferencia menor: hasta 5 unidades o hasta el 5% de la
                existencia del sistema. La cantidad se guarda al salir del
                campo.
              </p>
            </div>
            {canPost && detail.count.status === "draft" ? (
              <PostCountButton
                countId={detail.count.id}
                pendingLines={
                  detail.lines.filter((line) => line.counted_qty == null)
                    .length
                }
              />
            ) : null}
          </div>

          <CountLinesPanel
            lines={detail.lines}
            canWrite={canWrite}
            isDraft={detail.count.status === "draft"}
          />
        </div>
      ) : null}
    </div>
  );
}
