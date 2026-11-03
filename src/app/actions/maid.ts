"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import { parseNonNegativeNumber, parseRequiredText } from "@/lib/actions/parse";
import { hotelToday } from "@/lib/format/datetime";
import { createClient } from "@/lib/supabase/server";
import { SERVICE_TYPES } from "@/lib/maid/preview";

export type ActionState = {
  error?: string;
  success?: string;
};

const SERVICE_TYPE_SET = new Set<string>(SERVICE_TYPES);

export async function createRoomParam(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("categorias");
  if (!gate.ok) return { error: gate.error };

  const productId = String(formData.get("product_id") ?? "");
  const roomType = String(formData.get("room_type") ?? "standard").trim() || "standard";
  const serviceType = String(formData.get("service_type") ?? "ocupacion");
  const qty = parseNonNegativeNumber(formData.get("qty_per_room"), "la cantidad por habitación");

  if (!productId || !SERVICE_TYPE_SET.has(serviceType)) {
    return { error: "Producto y tipo de servicio válidos son obligatorios." };
  }
  if (!qty.ok) return { error: qty.error };

  const supabase = await createClient();
  const { error } = await supabase.from("room_supply_params").insert({
    product_id: productId,
    room_type: roomType,
    service_type: serviceType,
    qty_per_room: qty.value,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo crear el parámetro.") };
  }

  revalidatePath("/dotacion");
  return { success: "Parámetro creado." };
}

export async function upsertRoomParam(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("categorias");
  if (!gate.ok) return { error: gate.error };

  const productId = String(formData.get("product_id") ?? "");
  const roomType = String(formData.get("room_type") ?? "standard").trim() || "standard";
  const serviceType = String(formData.get("service_type") ?? "ocupacion");
  const qty = parseNonNegativeNumber(formData.get("qty_per_room"), "la cantidad por habitación");

  if (!productId || !SERVICE_TYPE_SET.has(serviceType)) {
    return { error: "Producto y tipo de servicio válidos son obligatorios." };
  }
  if (!qty.ok) return { error: qty.error };

  const supabase = await createClient();
  const { error } = await supabase.from("room_supply_params").upsert(
    {
      product_id: productId,
      room_type: roomType,
      service_type: serviceType,
      qty_per_room: qty.value,
    },
    { onConflict: "product_id,room_type,service_type" },
  );

  if (error) {
    return { error: toActionError(error, "No se pudo guardar el parámetro.") };
  }

  revalidatePath("/dotacion");
  return { success: "Parámetro guardado." };
}

function parseCounts(formData: FormData): {
  room_type: string;
  service_type: string;
  room_count: number;
}[] {
  const counts: {
    room_type: string;
    service_type: string;
    room_count: number;
  }[] = [];

  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("count|")) continue;
    const parts = key.split("|");
    if (parts.length !== 3) continue;
    const roomType = parts[1]?.trim();
    const serviceType = parts[2]?.trim();
    const roomCount = Number(raw);
    if (!roomType || !SERVICE_TYPE_SET.has(serviceType)) continue;
    if (Number.isNaN(roomCount) || roomCount <= 0) continue;
    counts.push({
      room_type: roomType,
      service_type: serviceType,
      room_count: Math.floor(roomCount),
    });
  }

  return counts;
}

export async function createAllocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("dotacion");
  if (!gate.ok) return { error: gate.error };

  const maidName = parseRequiredText(formData.get("maid_name"), "Nombre de camarera");
  const shift = String(formData.get("shift") ?? "").trim() || null;
  const allocationDate =
    String(formData.get("allocation_date") ?? "").trim() || hotelToday();

  if (!maidName.ok) return { error: maidName.error };

  const counts = parseCounts(formData);
  if (counts.length === 0) {
    return { error: "Indica al menos un conteo de habitaciones." };
  }

  const supabase = await createClient();
  const { data: allocation, error } = await supabase
    .from("maid_allocations")
    .insert({
      maid_name: maidName.value,
      shift,
      allocation_date: allocationDate,
      status: "draft",
      created_by: gate.user.id,
    })
    .select("id")
    .single();

  if (error || !allocation) {
    return { error: toActionError(error, "No se pudo crear la dotación.") };
  }

  const { error: countsError } = await supabase
    .from("maid_allocation_counts")
    .insert(
      counts.map((row) => ({
        allocation_id: allocation.id,
        room_type: row.room_type,
        service_type: row.service_type,
        room_count: row.room_count,
      })),
    );

  if (countsError) {
    await supabase.from("maid_allocations").delete().eq("id", allocation.id);
    return { error: toActionError(countsError, "No se pudieron guardar los conteos de habitaciones.") };
  }

  revalidatePath("/dotacion");
  return { success: "Dotación en borrador creada." };
}

export async function confirmAllocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("dotacion");
  if (!gate.ok) return { error: gate.error };

  const allocationId = String(formData.get("allocation_id") ?? "");
  if (!allocationId) return { error: "Dotación requerida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_maid_allocation", {
    p_allocation_id: allocationId,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo confirmar la dotación.") };
  }

  revalidatePath("/dotacion");
  revalidatePath("/movimientos");
  revalidatePath("/inventario");
  revalidatePath("/alertas");
  revalidatePath("/");
  return { success: "Dotación confirmada; salidas registradas." };
}

export async function reviseAllocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("dotacion");
  if (!gate.ok) return { error: gate.error };

  const allocationId = String(formData.get("allocation_id") ?? "");
  if (!allocationId) return { error: "Dotación requerida." };

  const counts = parseCounts(formData);
  if (counts.length === 0) {
    return { error: "Indica al menos un conteo de habitaciones." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("revise_maid_allocation", {
    p_allocation_id: allocationId,
    p_counts: counts,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo rectificar la dotación.") };
  }

  revalidatePath("/dotacion");
  revalidatePath("/movimientos");
  revalidatePath("/inventario");
  revalidatePath("/alertas");
  revalidatePath("/reportes");
  revalidatePath("/");
  return { success: "Dotación rectificada; kardex actualizado." };
}
