import { OccupancyBarChart } from "@/components/occupancy/occupancy-chart";
import {
  DailyOccupancyForm,
  HotelRoomsForm,
} from "@/components/occupancy/occupancy-form";
import { PageHeader } from "@/components/ui/page-header";
import { canManageOccupancy } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { hotelMonth, hotelToday } from "@/lib/format/datetime";
import { assertQuery } from "@/lib/supabase/assert";
import {
  daysInMonth,
  formatMonthLabel,
  formatMonthShort,
} from "@/lib/stats/occupancy";
import { monthlyVariationPct } from "@/lib/stats/variation";
import { createClient } from "@/lib/supabase/server";

function previousMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function variationLabel(value: number | null) {
  if (value == null) return "";
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return ` (${sign}${rounded}% vs mes anterior)`;
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { profile } = await requireModule("estadisticas");
  const supabase = await createClient();
  const canManage = canManageOccupancy(profile?.role);
  const sp = await searchParams;
  const currentMonth = hotelMonth();
  const selectedMonth =
    sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : currentMonth;

  const monthStart = `${selectedMonth}-01`;
  const monthEndDate = daysInMonth(selectedMonth);
  const monthEnd = `${selectedMonth}-${String(monthEndDate).padStart(2, "0")}`;

  const [settings, daily, monthlyView, occupancyLegacy, consumption] =
    await Promise.all([
      supabase
        .from("hotel_settings")
        .select("total_rooms")
        .eq("id", 1)
        .maybeSingle()
        .then((result) => assertQuery(result, "No se pudo leer la configuración.")),
      supabase
        .from("daily_occupancy")
        .select(
          "occupancy_date, occupied_dirty, occupied_clean, total_rooms, occupancy_pct, notes",
        )
        .gte("occupancy_date", monthStart)
        .lte("occupancy_date", monthEnd)
        .order("occupancy_date")
        .then((result) => assertQuery(result, "No se pudo leer la ocupación diaria.")),
      supabase
        .from("v_monthly_occupancy")
        .select("year_month, occupancy_pct, days_recorded")
        .order("year_month")
        .then((result) => assertQuery(result, "No se pudo leer la ocupación mensual.")),
      supabase
        .from("monthly_occupancy")
        .select("year_month, occupancy_pct, rooms_sold, notes")
        .order("year_month", { ascending: false })
        .then((result) => assertQuery(result, "No se pudo leer la ocupación histórica.")),
      supabase
        .from("v_monthly_consumption_by_category")
        .select("year_month, category_code, category_name, quantity_out")
        .then((result) =>
          assertQuery(result, "No se pudo leer el consumo por categoría."),
        ),
    ]);

  const totalRooms = Number(settings?.total_rooms ?? 100);
  const dailyByDate = new Map(
    (daily ?? []).map((row) => [row.occupancy_date, row]),
  );
  const dailyBars = Array.from({ length: monthEndDate }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    const date = `${selectedMonth}-${day}`;
    const row = dailyByDate.get(date);
    return {
      key: date,
      label: String(i + 1),
      pct: row ? Number(row.occupancy_pct) : 0,
    };
  });

  const monthlyFromDaily = new Map(
    (monthlyView ?? []).map((row) => [
      String(row.year_month).slice(0, 7),
      Number(row.occupancy_pct),
    ]),
  );
  const monthlyKeys = new Set<string>([
    ...monthlyFromDaily.keys(),
    ...(occupancyLegacy ?? []).map((row) => row.year_month.slice(0, 7)),
  ]);
  const monthlyBars = Array.from(monthlyKeys)
    .sort()
    .map((key) => ({
      key,
      label: formatMonthShort(key),
      detail: formatMonthLabel(key),
      pct: monthlyFromDaily.get(key) ??
        Number(
          (occupancyLegacy ?? []).find((row) => row.year_month.slice(0, 7) === key)
            ?.occupancy_pct ?? 0,
        ),
    }));

  type Bucket = { month: string; category: string; qty: number };
  const buckets = new Map<string, Bucket>();
  for (const row of consumption ?? []) {
    const month = String(row.year_month).slice(0, 7);
    const category = row.category_name ?? row.category_code ?? "Sin categoría";
    const key = `${month}|${category}`;
    const prev = buckets.get(key) ?? { month, category, qty: 0 };
    prev.qty += Number(row.quantity_out);
    buckets.set(key, prev);
  }

  const byMonth = new Map<string, { category: string; qty: number }[]>();
  for (const b of buckets.values()) {
    const list = byMonth.get(b.month) ?? [];
    list.push({ category: b.category, qty: b.qty });
    byMonth.set(b.month, list);
  }

  const months = Array.from(byMonth.keys()).sort().reverse();
  const maxQty = Math.max(
    1,
    ...Array.from(buckets.values()).map((b) => b.qty),
  );

  const selectedMonthPct =
    monthlyFromDaily.get(selectedMonth) ??
    Number(
      (occupancyLegacy ?? []).find(
        (row) => row.year_month.slice(0, 7) === selectedMonth,
      )?.occupancy_pct ?? NaN,
    );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Estadísticas"
        description="Ocupación diaria y mensual (dirty / clean) contra consumo real del kardex."
      />

      {canManage ? (
        <>
          <HotelRoomsForm totalRooms={totalRooms} />
          <DailyOccupancyForm totalRooms={totalRooms} today={hotelToday()} />
        </>
      ) : null}

      <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label className="text-xs text-zinc-500" htmlFor="mes">
            Mes de la gráfica diaria
          </label>
          <input
            id="mes"
            name="mes"
            type="month"
            defaultValue={selectedMonth}
            className="mt-1 min-h-11 rounded-md border border-zinc-300 px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm hover:bg-zinc-50"
        >
          Ver mes
        </button>
      </form>

      <OccupancyBarChart
        title={`Ocupación diaria · ${formatMonthLabel(selectedMonth)}${
          Number.isFinite(selectedMonthPct)
            ? ` · promedio ${selectedMonthPct}%`
            : ""
        }`}
        bars={dailyBars}
      />

      <OccupancyBarChart
        title="Ocupación mensual"
        bars={monthlyBars}
        editableTitle
      />

      <section>
        <h2 className="text-lg font-semibold">Registro diario ({formatMonthLabel(selectedMonth)})</h2>
        {(daily ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Sin ocupación diaria en este mes.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Dirty</th>
                  <th className="px-4 py-3 font-medium">Clean</th>
                  <th className="px-4 py-3 font-medium">Total hab.</th>
                  <th className="px-4 py-3 font-medium">Ocupación %</th>
                </tr>
              </thead>
              <tbody>
                {(daily ?? []).map((row) => (
                  <tr key={row.occupancy_date} className="border-t border-zinc-100">
                    <td className="px-4 py-3">{row.occupancy_date}</td>
                    <td className="px-4 py-3 tabular-nums">{row.occupied_dirty}</td>
                    <td className="px-4 py-3 tabular-nums">{row.occupied_clean}</td>
                    <td className="px-4 py-3 tabular-nums">{row.total_rooms}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {Number(row.occupancy_pct)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Consumo por categoría (salidas)</h2>
        {months.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Aún no hay salidas registradas.
          </p>
        ) : (
          <div className="mt-3 space-y-6">
            {months.map((month) => {
              const rows = (byMonth.get(month) ?? []).sort(
                (a, b) => b.qty - a.qty,
              );
              const previousKey = previousMonthKey(month);
              const previousRows = byMonth.get(previousKey) ?? [];
              const occPct =
                monthlyFromDaily.get(month) ??
                Number(
                  (occupancyLegacy ?? []).find(
                    (o) => o.year_month.slice(0, 7) === month,
                  )?.occupancy_pct ?? NaN,
                );
              return (
                <div
                  key={month}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium">{formatMonthLabel(month)}</h3>
                    <p className="text-xs text-zinc-500">
                      {Number.isFinite(occPct)
                        ? `Ocupación ${occPct}%`
                        : "Sin ocupación registrada"}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {rows.map((r) => (
                      <li key={r.category}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{r.category}</span>
                          <span className="tabular-nums text-zinc-600">
                            {r.qty}
                            {variationLabel(
                              monthlyVariationPct(
                                r.qty,
                                previousRows.find(
                                  (prev) => prev.category === r.category,
                                )?.qty ?? null,
                              ),
                            )}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded bg-zinc-100 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${Math.max(4, (r.qty / maxQty) * 100)}%`,
                              backgroundColor: "#0f766e",
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
