import {
  AllocationPreviewTables,
  ConfirmAllocationButton,
  CreateAllocationForm,
  ReviseAllocationForm,
  RoomParamForm,
} from "@/components/maid/maid-forms";
import { PageHeader } from "@/components/ui/page-header";
import {
  canConfirmAllocation,
  canManageRoomParams,
  canWriteAllocation,
} from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import {
  previewAllocationMatrix,
  SERVICE_LABELS,
  type ServiceType,
} from "@/lib/maid/preview";
import { hotelToday } from "@/lib/format/datetime";
import { allocationStatusLabel } from "@/lib/format/labels";
import { createClient } from "@/lib/supabase/server";

export default async function DotacionPage() {
  const { profile } = await requireModule("dotacion");
  const supabase = await createClient();
  const canParams = canManageRoomParams(profile?.role);
  const canCreate = canWriteAllocation(profile?.role);
  const canConfirm = canConfirmAllocation(profile?.role);

  const [
    { data: params },
    { data: products },
    { data: allocations },
  ] = await Promise.all([
    supabase
      .from("room_supply_params")
      .select(
        "id, room_type, service_type, qty_per_room, products(code, name, product_categories(code))",
      )
      .order("room_type"),
    supabase
      .from("products")
      .select("id, code, name")
      .eq("is_active", true)
      .order("code"),
    supabase
      .from("maid_allocations")
      .select(
        "id, maid_name, shift, allocation_date, status, confirmed_at, revised_at, revision_count, maid_allocation_rooms(room_number, room_type, service_type), maid_allocation_counts(room_type, service_type, room_count)",
      )
      .order("allocation_date", { ascending: false })
      .limit(30),
  ]);

  const supplyParams = (params ?? []).map((param) => {
    const product = Array.isArray(param.products)
      ? param.products[0]
      : param.products;
    const category = Array.isArray(product?.product_categories)
      ? product.product_categories[0]
      : product?.product_categories;
    return {
      productCode: product?.code ?? param.id,
      productName: product?.name ?? "Producto",
      categoryCode: category?.code ?? "",
      roomType: param.room_type,
      serviceType: param.service_type,
      qtyPerRoom: Number(param.qty_per_room),
    };
  });

  const roomTypes = Array.from(
    new Set((params ?? []).map((p) => p.room_type).filter(Boolean)),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dotación por camarera"
        description="Conteo de habitaciones por estatus → total por producto → salidas al confirmar. Una confirmada se puede rectificar."
      />

      {canParams ? (
        <RoomParamForm products={products ?? []} mode="upsert" />
      ) : null}
      {canCreate ? (
        <CreateAllocationForm
          roomTypes={roomTypes}
          params={supplyParams}
          today={hotelToday()}
        />
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">Parámetros por habitación</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Tipo hab.</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Cant. / hab.</th>
              </tr>
            </thead>
            <tbody>
              {(params ?? []).map((p) => {
                const product = Array.isArray(p.products)
                  ? p.products[0]
                  : p.products;
                return (
                  <tr key={p.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      {product ? `${product.code} — ${product.name}` : "—"}
                    </td>
                    <td className="px-4 py-3">{p.room_type}</td>
                    <td className="px-4 py-3">
                      {SERVICE_LABELS[p.service_type as ServiceType] ??
                        p.service_type}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {Number(p.qty_per_room)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Dotaciones</h2>
        <ul className="mt-3 space-y-3">
          {(allocations ?? []).map((a) => {
            const counts = a.maid_allocation_counts ?? [];
            const rooms = a.maid_allocation_rooms ?? [];
            const previewRooms =
              counts.length > 0
                ? counts.map((c) => ({
                    roomType: c.room_type,
                    serviceType: c.service_type,
                    count: Number(c.room_count),
                  }))
                : rooms.map((room) => ({
                    roomType: room.room_type,
                    serviceType: room.service_type,
                    count: 1,
                  }));
            const matrix = previewAllocationMatrix(previewRooms, supplyParams);
            return (
              <li
                key={a.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.maid_name}</p>
                    <p className="text-sm text-zinc-600">
                      {a.allocation_date}
                      {a.shift ? ` · ${a.shift}` : ""} ·{" "}
                      {allocationStatusLabel(a.status)}
                      {a.revision_count > 0
                        ? ` · rectificada ${a.revision_count} ${a.revision_count === 1 ? "vez" : "veces"}`
                        : ""}
                    </p>
                    {counts.length > 0 ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {counts
                          .map(
                            (c) =>
                              `${c.room_type} ${SERVICE_LABELS[c.service_type as ServiceType] ?? c.service_type}: ${c.room_count}`,
                          )
                          .join(" · ")}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-zinc-500">
                        Hab: {rooms.map((r) => r.room_number).join(", ") || "—"}
                      </p>
                    )}
                    <div className="mt-3">
                      <AllocationPreviewTables preview={matrix} />
                    </div>
                  </div>
                  {a.status === "draft" && canConfirm ? (
                    <ConfirmAllocationButton allocationId={a.id} />
                  ) : null}
                </div>
                {a.status === "confirmed" && canConfirm ? (
                  <ReviseAllocationForm
                    allocationId={a.id}
                    roomTypes={roomTypes}
                    params={supplyParams}
                    initialCounts={previewRooms}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
