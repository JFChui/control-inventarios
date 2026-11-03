import Link from "next/link";
import {
  ReturnLinnerForm,
  SetLinnerParForm,
  StockLinnerForm,
} from "@/components/linen/linen-linner-forms";
import { PageHeader } from "@/components/ui/page-header";
import { canWriteLinen } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function BlancosLinnersPage() {
  const { profile } = await requireModule("blancos");
  const supabase = await createClient();
  const canWrite = canWriteLinen(profile?.role);

  const [{ data: locations }, { data: summary }] = await Promise.all([
    supabase
      .from("storage_locations")
      .select("id, code, name, kind, sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("products")
      .select(
        "id, code, name, product_categories!inner(code), linen_items!inner(id, linen_location_stock(location_id, quantity, par_qty))",
      )
      .eq("product_categories.code", "BLAN")
      .eq("is_active", true)
      .order("code"),
  ]);

  const locs = locations ?? [];
  const items = (summary ?? []).map((item) => {
    const linen = Array.isArray(item.linen_items)
      ? item.linen_items[0]
      : item.linen_items;
    const stocks = new Map(
      (linen?.linen_location_stock ?? []).map((row) => [
        row.location_id as string,
        { qty: Number(row.quantity), par: Number(row.par_qty) },
      ]),
    );
    return {
      linenId: linen?.id as string,
      code: item.code,
      name: item.name,
      stocks,
    };
  });

  const options = items.map((item) => ({
    id: item.linenId,
    label: `${item.code} — ${item.name}`,
  }));
  const locationOptions = locs.map((loc) => ({
    id: loc.id,
    code: loc.code,
    name: loc.name,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Linners"
        description="Almacenes de piso (L06–L26, sin L13) y Recepción. El lencero surte contra el par de cada blanco."
      />
      <p className="print:hidden">
        <Link href="/blancos" className="text-sm font-medium text-teal-800 hover:underline">
          ← Control de blancos
        </Link>
      </p>

      {canWrite ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <StockLinnerForm items={options} locations={locationOptions} />
          <ReturnLinnerForm items={options} locations={locationOptions} />
          <SetLinnerParForm items={options} locations={locationOptions} />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="sticky left-0 bg-zinc-50 px-3 py-3 font-medium">Blanco</th>
              {locs.map((loc) => (
                <th key={loc.id} className="px-3 py-3 font-medium">
                  {loc.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.linenId} className="border-t border-zinc-100">
                <td className="sticky left-0 bg-white px-3 py-2 font-medium">
                  <span className="font-mono text-xs text-zinc-500">{item.code}</span>{" "}
                  {item.name}
                </td>
                {locs.map((loc) => {
                  const cell = item.stocks.get(loc.id) ?? { qty: 0, par: 0 };
                  const short = cell.par > 0 && cell.qty < cell.par;
                  return (
                    <td
                      key={loc.id}
                      className={`px-3 py-2 tabular-nums ${short ? "bg-amber-50 text-amber-900" : ""}`}
                    >
                      {cell.qty}
                      {cell.par > 0 ? (
                        <span className="block text-[10px] text-zinc-500">
                          par {cell.par}
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
