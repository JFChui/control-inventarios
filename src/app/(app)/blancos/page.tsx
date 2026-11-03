import Link from "next/link";
import { LinenCreateForm } from "@/components/linen/linen-create-form";
import { SetPiecesPerRoomForm } from "@/components/linen/linen-linner-forms";
import { LinenTransitionForm } from "@/components/linen/linen-transition-form";
import { PageHeader } from "@/components/ui/page-header";
import { canManageLinen, canWriteLinen } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { formatTurns, linenTurns } from "@/lib/linen/turns";
import { createClient } from "@/lib/supabase/server";

export default async function BlancosPage() {
  const { profile } = await requireModule("blancos");
  const supabase = await createClient();
  const manage = canManageLinen(profile?.role);
  const canWrite = canWriteLinen(profile?.role);

  const [{ data: summary }, { data: settings }, { data: locations }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, code, name, quantity_on_hand, product_categories!inner(code), linen_items(id, available, in_use, in_laundry, damaged, written_off, pieces_per_room, linen_location_stock(quantity))",
        )
        .eq("product_categories.code", "BLAN")
        .eq("is_active", true)
        .order("code"),
      supabase.from("hotel_settings").select("total_rooms").eq("id", 1).maybeSingle(),
      supabase
        .from("storage_locations")
        .select("id, code, name")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  const totalRooms = Number(settings?.total_rooms ?? 212);

  const rows = (summary ?? []).map((item) => {
    const linen = Array.isArray(item.linen_items)
      ? item.linen_items[0]
      : item.linen_items;
    const available = Number(linen?.available ?? 0);
    const inUse = Number(linen?.in_use ?? 0);
    const inLaundry = Number(linen?.in_laundry ?? 0);
    const damaged = Number(linen?.damaged ?? 0);
    const writtenOff = Number(linen?.written_off ?? 0);
    const piecesPerRoom = Number(linen?.pieces_per_room ?? 0);
    const stocks = linen?.linen_location_stock ?? [];
    const inLinners = stocks.reduce(
      (sum, row) => sum + Number(row.quantity ?? 0),
      0,
    );
    const warehouse = available - inLinners;
    const stock = Number(item.quantity_on_hand);
    const active = available + inUse + inLaundry + damaged;
    return {
      product_id: item.id,
      linen_id: linen?.id ?? null,
      code: item.code,
      name: item.name,
      stock,
      available,
      warehouse,
      inLinners,
      inUse,
      inLaundry,
      damaged,
      writtenOff,
      piecesPerRoom,
      turns: linenTurns(available, inUse, inLaundry, totalRooms, piecesPerRoom),
      active,
      drift: active - stock,
    };
  });

  const pendingProducts = rows
    .filter((row) => !row.linen_id)
    .map((row) => ({
      id: row.product_id,
      code: row.code,
      name: row.name,
    }));

  const registered = rows
    .filter((row) => row.linen_id)
    .map((row) => ({
      id: row.linen_id as string,
      label: `${row.code} — ${row.name}`,
    }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Control de blancos"
        description={`Disponible + en uso + lavandería + dañado = existencia. Vueltas = existencia activa / (${totalRooms} hab. × piezas por habitación).`}
      />

      <p className="print:hidden">
        <Link
          href="/blancos/linners"
          className="text-sm font-medium text-teal-800 hover:underline"
        >
          Ver linners (par y existencia por piso) →
        </Link>
      </p>

      {manage ? <LinenCreateForm products={pendingProducts} /> : null}

      {canWrite ? (
        <LinenTransitionForm
          items={registered}
          locations={(locations ?? []).map((loc) => ({
            id: loc.id,
            code: loc.code,
            name: loc.name,
          }))}
        />
      ) : null}

      {canWrite ? <SetPiecesPerRoomForm items={registered} /> : null}

      <div>
        <h2 className="text-lg font-semibold">Existencias por estado</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Existencia</th>
                <th className="px-4 py-3 font-medium">Disponible</th>
                <th className="px-4 py-3 font-medium">Lavandería (almacén)</th>
                <th className="px-4 py-3 font-medium">En linners</th>
                <th className="px-4 py-3 font-medium">En uso</th>
                <th className="px-4 py-3 font-medium">En lavandería</th>
                <th className="px-4 py-3 font-medium">Dañado</th>
                <th className="px-4 py-3 font-medium">Baja</th>
                <th className="px-4 py-3 font-medium">
                  Vueltas ({totalRooms} hab.)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.product_id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-3 font-medium">
                    {row.name}
                    {row.drift !== 0 ? (
                      <span className="mt-1 block text-xs font-normal text-red-700">
                        Descuadre: activo {row.active} vs existencia {row.stock}
                      </span>
                    ) : null}
                    {row.piecesPerRoom > 0 ? (
                      <span className="mt-1 block text-xs font-normal text-zinc-500">
                        {row.piecesPerRoom} pza / hab.
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.stock}</td>
                  <td className="px-4 py-3 tabular-nums">{row.available}</td>
                  <td className="px-4 py-3 tabular-nums">{row.warehouse}</td>
                  <td className="px-4 py-3 tabular-nums">{row.inLinners}</td>
                  <td className="px-4 py-3 tabular-nums">{row.inUse}</td>
                  <td className="px-4 py-3 tabular-nums">{row.inLaundry}</td>
                  <td className="px-4 py-3 tabular-nums">{row.damaged}</td>
                  <td className="px-4 py-3 tabular-nums">{row.writtenOff}</td>
                  <td className="px-4 py-3 tabular-nums">{formatTurns(row.turns)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
