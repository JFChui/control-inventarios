import Link from "next/link";
import { BlancosReport } from "@/components/reports/blancos-report";
import { DotacionReport } from "@/components/reports/dotacion-report";
import { LinnerRecepcionReport } from "@/components/reports/linner-recepcion-report";
import { MaquinariaReport } from "@/components/reports/maquinaria-report";
import { UniformesReport } from "@/components/reports/uniformes-report";
import { PageHeader } from "@/components/ui/page-header";
import { requireModule } from "@/lib/auth/session";
import { hotelToday } from "@/lib/format/datetime";
import { STOCK_STATUS_UI, stockBadge, type StockStatus } from "@/lib/stock/status";
import { createClient } from "@/lib/supabase/server";

type Vista =
  | "inventario"
  | "alertas"
  | "maquinaria"
  | "blancos"
  | "uniformes"
  | "dotacion"
  | "linner_recepcion";

const VISTAS = new Set<Vista>([
  "inventario",
  "alertas",
  "maquinaria",
  "blancos",
  "uniformes",
  "dotacion",
  "linner_recepcion",
]);

function shiftIsoDate(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; desde?: string; hasta?: string }>;
}) {
  await requireModule("reportes");
  const sp = await searchParams;
  const vista: Vista = VISTAS.has(sp.vista as Vista)
    ? (sp.vista as Vista)
    : "inventario";
  const today = hotelToday();
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(sp.desde ?? "")
    ? (sp.desde as string)
    : shiftIsoDate(today, -7);
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(sp.hasta ?? "")
    ? (sp.hasta as string)
    : today;

  const tabs: { id: Vista; label: string }[] = [
    { id: "inventario", label: "Inventario actual" },
    { id: "alertas", label: "Bajo stock" },
    { id: "maquinaria", label: "Maquinaria" },
    { id: "blancos", label: "Blancos" },
    { id: "uniformes", label: "Uniformes" },
    { id: "dotacion", label: "Dotación" },
    { id: "linner_recepcion", label: "Linner recepción" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Inventario, alertas, maquinaria, blancos, uniformes, dotación y linner de recepción."
      />

      <div className="flex flex-wrap gap-2 print:hidden">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/reportes?vista=${t.id}`}
            className={`inline-flex min-h-10 items-center rounded-md px-3 text-sm ${
              vista === t.id
                ? "bg-teal-800 font-medium text-white"
                : "border border-zinc-300 bg-white hover:bg-zinc-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {vista === "dotacion" ? (
        <form method="get" className="flex flex-wrap items-end gap-2 print:hidden">
          <input type="hidden" name="vista" value="dotacion" />
          <label className="text-sm">
            Desde
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              className="mt-1 block min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            Hasta
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              className="mt-1 block min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
            />
          </label>
          <button
            type="submit"
            className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
          >
            Filtrar
          </button>
        </form>
      ) : null}

      {vista === "inventario" ? <InventarioReport /> : null}
      {vista === "alertas" ? <AlertasReport /> : null}
      {vista === "maquinaria" ? <MaquinariaReport /> : null}
      {vista === "blancos" ? <BlancosReport /> : null}
      {vista === "uniformes" ? <UniformesReport /> : null}
      {vista === "dotacion" ? <DotacionReport from={desde} to={hasta} /> : null}
      {vista === "linner_recepcion" ? <LinnerRecepcionReport /> : null}
    </div>
  );
}

async function InventarioReport() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select(
      "id, code, name, unit, quantity_on_hand, min_stock, is_active, inventory_initialized_at, product_categories(name)",
    )
    .order("code");

  return (
    <section>
      <h2 className="text-lg font-semibold">Inventario actual</h2>
      <ul className="mt-3 space-y-3 md:hidden">
        {(products ?? []).map((p) => {
          const qty = Number(p.quantity_on_hand);
          const min = Number(p.min_stock);
          const badge = stockBadge(
            qty,
            min,
            Boolean(p.inventory_initialized_at),
            p.is_active,
          );
          return (
            <li
              key={p.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex justify-between gap-2">
                <p className="font-medium">{p.name}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <p className="font-mono text-xs text-zinc-500">{p.code}</p>
              <p className="mt-2 text-sm tabular-nums">
                {qty} {p.unit} (mín. {min})
              </p>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
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
            {(products ?? []).map((p) => {
              const qty = Number(p.quantity_on_hand);
              const min = Number(p.min_stock);
              const badge = stockBadge(
            qty,
            min,
            Boolean(p.inventory_initialized_at),
            p.is_active,
          );
              return (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {qty} {p.unit}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{min}</td>
                  <td className="px-4 py-3">{badge.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function AlertasReport() {
  const supabase = await createClient();
  const { data: lowStock } = await supabase
    .from("v_products_low_stock")
    .select("id, code, name, unit, quantity_on_hand, min_stock, stock_status")
    .order("quantity_on_hand");

  return (
    <section>
      <h2 className="text-lg font-semibold">Productos bajo stock</h2>
      {(lowStock ?? []).length === 0 ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          No hay productos en alerta. Los ítems sin conteo inicial no aparecen
          aquí.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
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
              {(lowStock ?? []).map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {Number(p.quantity_on_hand)} {p.unit}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {Number(p.min_stock)}
                  </td>
                  <td className="px-4 py-3">
                    {STOCK_STATUS_UI[p.stock_status as StockStatus]?.label ??
                      p.stock_status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
