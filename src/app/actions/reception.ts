"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import { parseNonNegativeNumber, parsePositiveNumber } from "@/lib/actions/parse";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string };

export async function setReceptionLimits(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("linner_recepcion");
  if (!gate.ok) return { error: gate.error };

  const productId = String(formData.get("product_id") ?? "");
  const min = parseNonNegativeNumber(formData.get("min_qty"), "El mínimo");
  const max = parseNonNegativeNumber(formData.get("max_qty"), "El máximo");
  if (!productId) return { error: "Producto requerido." };
  if (!min.ok) return { error: min.error };
  if (!max.ok) return { error: max.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_reception_linner_limits", {
    p_product_id: productId,
    p_min: min.value,
    p_max: max.value,
  });
  if (error) {
    return { error: toActionError(error, "No se pudieron guardar mínimo y máximo.") };
  }
  revalidatePath("/inventario/linner-recepcion");
  revalidatePath("/movimientos");
  revalidatePath("/reportes");
  return { success: "Mínimo y máximo guardados." };
}

export async function consumeReceptionLinner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("linner_recepcion");
  if (!gate.ok) return { error: gate.error };

  const productId = String(formData.get("product_id") ?? "");
  const qty = parsePositiveNumber(formData.get("qty"), "La cantidad");
  if (!productId) return { error: "Producto requerido." };
  if (!qty.ok) return { error: qty.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("consume_reception_linner", {
    p_product_id: productId,
    p_qty: qty.value,
  });
  if (error) {
    return { error: toActionError(error, "No se pudo registrar el consumo.") };
  }
  revalidatePath("/inventario/linner-recepcion");
  revalidatePath("/reportes");
  return { success: "Consumo del linner registrado." };
}
