"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import { parseNonNegativeNumber, parsePositiveNumber } from "@/lib/actions/parse";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string };

const LINEN_STATES = new Set([
  "available",
  "in_use",
  "in_laundry",
  "damaged",
  "written_off",
]);

export async function createLinenItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("blancos");
  if (!gate.ok) return { error: gate.error };

  const productId = String(formData.get("product_id") ?? "");

  if (!productId) {
    return { error: "Selecciona un producto." };
  }

  const supabase = await createClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, quantity_on_hand, product_categories(code)")
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    return {
      error: toActionError(productError, "Producto no encontrado."),
    };
  }

  const category = Array.isArray(product.product_categories)
    ? product.product_categories[0]
    : product.product_categories;
  if (category?.code !== "BLAN") {
    return { error: "Solo los productos de blancos entran a este control." };
  }

  const { error } = await supabase.from("linen_items").insert({
    product_id: productId,
    available: Number(product.quantity_on_hand),
  });

  if (error) {
    return { error: toActionError(error, "No se pudo registrar el blanco.") };
  }

  revalidatePath("/blancos");
  revalidatePath("/blancos/linners");
  return { success: "Blanco registrado." };
}

export async function transitionLinen(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("blancos");
  if (!gate.ok) return { error: gate.error };

  const linenId = String(formData.get("linen_id") ?? "");
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const locationId = String(formData.get("location_id") ?? "").trim() || null;
  const qty = parsePositiveNumber(formData.get("qty"), "La cantidad");

  if (!linenId || !LINEN_STATES.has(from) || !LINEN_STATES.has(to)) {
    return { error: "Completa origen, destino y blanco." };
  }
  if (!qty.ok) return { error: qty.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_linen", {
    p_linen_id: linenId,
    p_from: from,
    p_to: to,
    p_qty: qty.value,
    p_location_id: locationId,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo actualizar el blanco.") };
  }

  revalidatePath("/blancos");
  revalidatePath("/blancos/linners");
  if (to === "written_off") {
    revalidatePath("/inventario");
    revalidatePath("/movimientos");
    revalidatePath("/alertas");
  }
  return { success: "Estado de blanco actualizado." };
}

export async function setLinenPiecesPerRoom(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("blancos");
  if (!gate.ok) return { error: gate.error };

  const linenId = String(formData.get("linen_id") ?? "");
  const qty = parseNonNegativeNumber(
    formData.get("pieces_per_room"),
    "Piezas por habitación",
  );
  if (!linenId) return { error: "Selecciona un blanco." };
  if (!qty.ok) return { error: qty.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_linen_pieces_per_room", {
    p_linen_id: linenId,
    p_qty: qty.value,
  });
  if (error) {
    return { error: toActionError(error, "No se pudieron guardar las piezas por habitación.") };
  }
  revalidatePath("/blancos");
  revalidatePath("/blancos/linners");
  revalidatePath("/reportes");
  return { success: "Piezas por habitación guardadas." };
}

export async function stockLinner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("blancos");
  if (!gate.ok) return { error: gate.error };

  const linenId = String(formData.get("linen_id") ?? "");
  const locationId = String(formData.get("location_id") ?? "");
  const qty = parsePositiveNumber(formData.get("qty"), "La cantidad");
  if (!linenId || !locationId) return { error: "Blanco y linner son obligatorios." };
  if (!qty.ok) return { error: qty.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("stock_linner", {
    p_linen_id: linenId,
    p_location_id: locationId,
    p_qty: qty.value,
  });
  if (error) {
    return { error: toActionError(error, "No se pudo surtir el linner.") };
  }
  revalidatePath("/blancos");
  revalidatePath("/blancos/linners");
  return { success: "Linner surtido." };
}

export async function returnFromLinner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("blancos");
  if (!gate.ok) return { error: gate.error };

  const linenId = String(formData.get("linen_id") ?? "");
  const locationId = String(formData.get("location_id") ?? "");
  const qty = parsePositiveNumber(formData.get("qty"), "La cantidad");
  if (!linenId || !locationId) return { error: "Blanco y linner son obligatorios." };
  if (!qty.ok) return { error: qty.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("return_from_linner", {
    p_linen_id: linenId,
    p_location_id: locationId,
    p_qty: qty.value,
  });
  if (error) {
    return { error: toActionError(error, "No se pudo devolver del linner.") };
  }
  revalidatePath("/blancos");
  revalidatePath("/blancos/linners");
  return { success: "Devuelto al almacén de lavandería." };
}

export async function setLinnerPar(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("blancos");
  if (!gate.ok) return { error: gate.error };

  const linenId = String(formData.get("linen_id") ?? "");
  const locationId = String(formData.get("location_id") ?? "");
  const par = parseNonNegativeNumber(formData.get("par_qty"), "El par");
  if (!linenId || !locationId) return { error: "Blanco y linner son obligatorios." };
  if (!par.ok) return { error: par.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_linner_par", {
    p_linen_id: linenId,
    p_location_id: locationId,
    p_par: par.value,
  });
  if (error) {
    return { error: toActionError(error, "No se pudo guardar el par.") };
  }
  revalidatePath("/blancos/linners");
  return { success: "Par del linner guardado." };
}
