"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import { parseOptionalText, parsePositiveNumber } from "@/lib/actions/parse";
import { createClient } from "@/lib/supabase/server";
import {
  assertDepartmentUserCanUseProduct,
  assertOutboundStock,
} from "@/lib/catalog/product-departments";

export type MovementState = {
  error?: string;
  success?: string;
};

export async function createMovement(
  _prev: MovementState,
  formData: FormData,
): Promise<MovementState> {
  const gate = await requireModuleAction("movimientos");
  if (!gate.ok) return { error: gate.error };

  const productId = String(formData.get("product_id") ?? "");
  const movementType = String(formData.get("movement_type") ?? "") as
    | "in"
    | "out";
  const quantity = parsePositiveNumber(formData.get("quantity"), "La cantidad");
  const requestedDepartmentId =
    String(formData.get("department_id") ?? "") || null;
  const supplier = parseOptionalText(formData.get("supplier"), "Proveedor");
  const reason = parseOptionalText(formData.get("reason"), "Motivo");
  const notes = parseOptionalText(formData.get("notes"), "Notas");

  if (!productId || (movementType !== "in" && movementType !== "out")) {
    return { error: "Producto y tipo de movimiento son obligatorios." };
  }
  if (!quantity.ok) return { error: quantity.error };
  if (!supplier.ok) return { error: supplier.error };
  if (!reason.ok) return { error: reason.error };
  if (!notes.ok) return { error: notes.error };

  const supabase = await createClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, quantity_on_hand, is_active")
    .eq("id", productId)
    .maybeSingle();

  if (productError) {
    return { error: toActionError(productError, "No se pudo leer el producto.") };
  }
  if (!product) return { error: "Producto no encontrado." };
  if (!product.is_active) return { error: "Producto inactivo." };

  const stock = assertOutboundStock(
    movementType,
    quantity.value,
    Number(product.quantity_on_hand),
  );
  if (!stock.ok) return { error: stock.error };

  let productDepartmentIds: string[] = [];
  if (gate.profile.role === "department_user") {
    const { data: enabledRows, error: enabledError } = await supabase
      .from("product_departments")
      .select("department_id")
      .eq("product_id", productId);

    if (enabledError) {
      return { error: toActionError(enabledError, "No se pudieron leer los departamentos del producto.") };
    }
    productDepartmentIds = (enabledRows ?? []).map((row) => row.department_id);
  }

  const access = assertDepartmentUserCanUseProduct({
    role: gate.profile.role,
    userDepartmentId: gate.profile.department_id,
    productDepartmentIds,
  });
  if (!access.ok) return { error: access.error };

  const departmentId =
    gate.profile.role === "department_user"
      ? gate.profile.department_id
      : requestedDepartmentId;

  const toReception = String(formData.get("destination") ?? "") === "reception_linner";
  if (toReception && movementType !== "out") {
    return { error: "El envío al linner de recepción es una salida." };
  }

  if (toReception) {
    const { error } = await supabase.rpc("stock_reception_linner", {
      p_product_id: productId,
      p_qty: quantity.value,
      p_reason: reason.value,
      p_notes: notes.value,
    });
    if (error) {
      return { error: toActionError(error, "No se pudo enviar al linner de recepción.") };
    }
    revalidatePath("/movimientos");
    revalidatePath("/inventario");
    revalidatePath("/inventario/linner-recepcion");
    revalidatePath("/blancos");
    revalidatePath("/blancos/linners");
    revalidatePath("/alertas");
    revalidatePath("/");
    return { success: "Enviado al linner de recepción." };
  }

  const { error } = await supabase.from("stock_movements").insert({
    product_id: productId,
    movement_type: movementType,
    quantity: quantity.value,
    department_id: departmentId,
    supplier: supplier.value,
    reason: reason.value,
    notes: notes.value,
    responsible_user_id: gate.user.id,
    source_type: "manual",
  });

  if (error) {
    return { error: toActionError(error, "No se pudo registrar el movimiento.") };
  }

  revalidatePath("/movimientos");
  revalidatePath("/inventario");
  revalidatePath("/alertas");
  revalidatePath("/");
  return { success: "Movimiento registrado." };
}
