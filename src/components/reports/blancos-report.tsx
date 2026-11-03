import { createClient } from "@/lib/supabase/server";
import { formatTurns, linenTurns } from "@/lib/linen/turns";

export async function BlancosReport() {
  const supabase = await createClient();
  const [{ data: summary }, { data: settings }, { data: locations }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, code, name, quantity_on_hand, product_categories!inner(code), linen_items(id, available, in_use, in_laundry, damaged, written_off, pieces_per_room, linen_location_stock(location_id, quantity))",
        )
        .eq("product_categories.code", "BLAN")
        .eq("is_active", true)
        .order("code"),
      supabase.from("hotel_settings").select("total_rooms").eq("id", 1).maybeSingle(),
      supabase
        .from("storage_locations")
        .select("id, code")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  const totalRooms = Number(settings?.total_rooms ?? 212);
  const locs = locations ?? [];

  return (
    <section>
      <h2 className="text-lg font-semibold">
        Control de blancos · ubicación y vueltas ({totalRooms} hab.)
      </h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-3 font-medium">Blanco</th>
              <th className="px-3 py-3 font-medium">Total</th>
              <th className="px-3 py-3 font-medium">Almacén lav.</th>
              {locs.map((loc) => (
                <th key={loc.id} className="px-3 py-3 font-medium">
                  {loc.code}
                </th>
              ))}
              <th className="px-3 py-3 font-medium">En uso</th>
              <th className="px-3 py-3 font-medium">En lavandería</th>
              <th className="px-3 py-3 font-medium">Dañado</th>
              <th className="px-3 py-3 font-medium">Vueltas</th>
            </tr>
          </thead>
          <tbody>
            {(summary ?? []).map((item) => {
              const linen = Array.isArray(item.linen_items)
                ? item.linen_items[0]
                : item.linen_items;
              const available = Number(linen?.available ?? 0);
              const inUse = Number(linen?.in_use ?? 0);
              const inLaundry = Number(linen?.in_laundry ?? 0);
              const damaged = Number(linen?.damaged ?? 0);
              const pieces = Number(linen?.pieces_per_room ?? 0);
              const byLoc = new Map(
                (linen?.linen_location_stock ?? []).map((row) => [
                  row.location_id as string,
                  Number(row.quantity),
                ]),
              );
              const located = Array.from(byLoc.values()).reduce((a, b) => a + b, 0);
              return (
                <tr key={item.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-zinc-500">{item.code}</span>{" "}
                    {item.name}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{Number(item.quantity_on_hand)}</td>
                  <td className="px-3 py-2 tabular-nums">{available - located}</td>
                  {locs.map((loc) => (
                    <td key={loc.id} className="px-3 py-2 tabular-nums">
                      {byLoc.get(loc.id) ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 tabular-nums">{inUse}</td>
                  <td className="px-3 py-2 tabular-nums">{inLaundry}</td>
                  <td className="px-3 py-2 tabular-nums">{damaged}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatTurns(linenTurns(available, inUse, inLaundry, totalRooms, pieces))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
