"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import { parseNonNegativeNumber } from "@/lib/actions/parse";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string };

export async function createPhysicalCount(
  _prev: ActionState,
  formData?: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("inventario_fisico");
  if (!gate.ok) return { error: gate.error };
  const { user, profile } = gate;

  const supabase = await createClient();
  const requestedDepartment = String(formData?.get("department_id") ?? "");
  const departmentId =
    profile?.role === "department_user"
      ? profile.department_id
      : requestedDepartment || null;
  const notes = String(formData?.get("notes") ?? "").trim() || null;

  if (profile?.role === "department_user" && !departmentId) {
    return { error: "Tu usuario no tiene departamento asignado." };
  }

  let productQuery = supabase
    .from("products")
    .select("id, quantity_on_hand")
    .eq("is_active", true);

  if (departmentId) {
    const { data: links, error: linksError } = await supabase
      .from("product_departments")
      .select("product_id")
      .eq("department_id", departmentId);
    if (linksError) {
      return { error: toActionError(linksError, "No se pudieron leer los productos del departamento.") };
    }
    const ids = (links ?? []).map((row) => row.product_id);
    if (ids.length === 0) {
      return { error: "Ese departamento no tiene productos habilitados." };
    }
    productQuery = productQuery.in("id", ids);
  }

  const { data: products, error: productsError } = await productQuery;

  if (productsError) {
    return { error: toActionError(productsError, "No se pudieron leer los productos.") };
  }
  if (!products?.length) {
    return { error: "No hay productos activos para contar." };
  }

  const { data: count, error } = await supabase
    .from("physical_counts")
    .insert({
      status: "draft",
      responsible_user_id: user.id,
      department_id: departmentId,
      notes,
    })
    .select("id")
    .single();

  if (error || !count) {
    return { error: toActionError(error, "No se pudo crear el conteo.") };
  }

  const { error: linesError } = await supabase.from("physical_count_lines").insert(
    products.map((p) => ({
      count_id: count.id,
      product_id: p.id,
      system_qty: Number(p.quantity_on_hand),
    })),
  );

  if (linesError) {
    await supabase.from("physical_counts").delete().eq("id", count.id);
    return { error: toActionError(linesError, "No se pudieron crear las líneas del conteo.") };
  }

  revalidatePath("/inventario-fisico");
  redirect(`/inventario-fisico?id=${count.id}`);
}

export async function updateCountedQty(
  lineId: string,
  qty: number,
): Promise<ActionState> {
  const gate = await requireModuleAction("inventario_fisico");
  if (!gate.ok) return { error: gate.error };

  if (!lineId || Number.isNaN(qty) || qty < 0) {
    return { error: "Cantidad contada inválida." };
  }

  const supabase = await createClient();
  const { data: line, error: lineError } = await supabase
    .from("physical_count_lines")
    .select("id, physical_counts(status)")
    .eq("id", lineId)
    .maybeSingle();

  if (lineError || !line) {
    return {
      error: toActionError(lineError, "Línea de conteo no encontrada."),
    };
  }

  const count = Array.isArray(line.physical_counts)
    ? line.physical_counts[0]
    : line.physical_counts;
  if (count?.status === "posted") {
    return { error: "El conteo cerrado no se puede editar." };
  }

  const { error } = await supabase
    .from("physical_count_lines")
    .update({ counted_qty: qty })
    .eq("id", lineId);

  if (error) {
    return { error: toActionError(error, "No se pudo guardar la cantidad contada.") };
  }

  revalidatePath("/inventario-fisico");
  return { success: "Cantidad actualizada." };
}

export async function updateCountedQtyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lineId = String(formData.get("line_id") ?? "");
  const parsed = parseNonNegativeNumber(
    formData.get("counted_qty"),
    "la cantidad contada",
  );
  if (!parsed.ok) return { error: parsed.error };
  return updateCountedQty(lineId, parsed.value);
}

export async function postPhysicalCount(id: string): Promise<ActionState> {
  const gate = await requireModuleAction("inventario_fisico");
  if (!gate.ok) return { error: gate.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_physical_count", {
    p_count_id: id,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo cerrar el conteo.") };
  }

  revalidatePath("/inventario-fisico");
  revalidatePath("/inventario");
  revalidatePath("/movimientos");
  revalidatePath("/alertas");
  revalidatePath("/blancos");
  revalidatePath("/");
  return { success: "Conteo cerrado. Se aplicaron ajustes al stock." };
}

export async function postPhysicalCountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("count_id") ?? "");
  if (!id) return { error: "Conteo inválido." };
  return postPhysicalCount(id);
}
