"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import { parseOptionalText, parsePositiveNumber, parseRequiredText } from "@/lib/actions/parse";
import { createClient } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/catalog/rules";
import {
  normalizeWorkerField,
  resolveWorkerId,
} from "@/lib/uniforms/workers";

export type ActionState = {
  error?: string;
  success?: string;
};

export async function createUniformSku(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("uniformes");
  if (!gate.ok) return { error: gate.error };

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const name = parseRequiredText(formData.get("name"), "Nombre");
  const departmentId = String(formData.get("department_id") ?? "") || null;
  const size = parseRequiredText(formData.get("size"), "Talla", 40);
  const total = parseNonNegativeFromForm(formData.get("total"), "Total");

  if (!code) {
    return { error: "Código, nombre y talla son obligatorios." };
  }
  if (!name.ok) return { error: name.error };
  if (!size.ok) return { error: size.error };
  if (!total.ok) return { error: total.error };

  const supabase = await createClient();
  const { error } = await supabase.from("uniform_skus").insert({
    code,
    name: name.value,
    department_id: departmentId,
    size: size.value,
    total: total.value,
    available: total.value,
    in_use: 0,
    unusable: 0,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo registrar el uniforme.") };
  }

  revalidatePath("/uniformes");
  return { success: "Uniforme registrado." };
}

function parseNonNegativeFromForm(raw: unknown, label: string) {
  const text = String(raw ?? "").trim();
  if (text === "") return { ok: false as const, error: `Indica ${label}.` };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false as const, error: `${label} inválido.` };
  }
  return { ok: true as const, value };
}

export async function assignUniform(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("uniformes");
  if (!gate.ok) return { error: gate.error };

  const skuId = String(formData.get("sku_id") ?? "");
  const quantity = parsePositiveNumber(formData.get("quantity"), "Cantidad");
  const notes = parseOptionalText(formData.get("notes"), "Notas");

  if (!skuId) {
    return { error: "Prenda y trabajador son obligatorios." };
  }
  if (!quantity.ok) return { error: quantity.error };
  if (!notes.ok) return { error: notes.error };

  const supabase = await createClient();
  const { data: roster, error: rosterError } = await supabase
    .from("uniform_workers")
    .select("id, uniform_code, last_name, first_name, staff_department")
    .eq("is_active", true);

  if (rosterError) {
    return { error: toActionError(rosterError, "No se pudo leer el padrón.") };
  }

  const workerId = resolveWorkerId(
    roster ?? [],
    String(formData.get("worker_id") ?? ""),
    String(formData.get("worker_query") ?? ""),
  );
  if (!workerId) {
    return { error: "Elija un trabajador del padrón." };
  }

  const { error } = await supabase.rpc("assign_uniform", {
    p_sku_id: skuId,
    p_worker_id: workerId,
    p_qty: quantity.value,
    p_notes: notes.value,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo asignar el uniforme.") };
  }

  revalidatePath("/uniformes");
  return { success: "Uniforme asignado." };
}

export async function returnUniform(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("uniformes");
  if (!gate.ok) return { error: gate.error };

  const assignmentId = String(formData.get("assignment_id") ?? "");
  if (!assignmentId) return { error: "Asignación requerida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("return_uniform", {
    p_assignment_id: assignmentId,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo devolver el uniforme.") };
  }

  revalidatePath("/uniformes");
  return { success: "Uniforme devuelto." };
}

export async function adjustUniformSku(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("uniformes");
  if (!gate.ok) return { error: gate.error };

  const skuId = String(formData.get("sku_id") ?? "");
  const delta = Number(formData.get("delta_total") ?? 0);
  const reason = parseRequiredText(formData.get("reason"), "Motivo");

  if (!skuId || !reason.ok) {
    return { error: reason.ok ? "Prenda y motivo son obligatorios." : reason.error };
  }
  if (!delta || !Number.isFinite(delta)) {
    return { error: "El ajuste debe ser distinto de cero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_uniform_sku", {
    p_sku_id: skuId,
    p_delta: delta,
    p_reason: reason.value,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo registrar el ajuste.") };
  }

  revalidatePath("/uniformes");
  return { success: "Ajuste registrado." };
}

export async function createUniformWorker(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("uniformes");
  if (!gate.ok) return { error: gate.error };

  const uniformCode = normalizeWorkerField(
    String(formData.get("uniform_code") ?? ""),
  );
  const lastName = normalizeWorkerField(String(formData.get("last_name") ?? ""));
  const firstName = normalizeWorkerField(
    String(formData.get("first_name") ?? ""),
  );
  const staffDepartment = normalizeWorkerField(
    String(formData.get("staff_department") ?? ""),
  );
  const position = normalizeWorkerField(String(formData.get("position") ?? ""));
  const employmentType =
    String(formData.get("employment_type") ?? "fijo") === "eventual"
      ? "eventual"
      : "fijo";

  if (!uniformCode || !lastName || !firstName || !staffDepartment || !position) {
    return {
      error: "Código, apellidos, nombres, departamento y cargo son obligatorios.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("uniform_workers").insert({
    uniform_code: uniformCode,
    last_name: lastName,
    first_name: firstName,
    staff_department: staffDepartment,
    position,
    employment_type: employmentType,
    is_active: true,
  });

  if (error) {
    if (isUniqueViolation(error)) {
      return { error: "Ya existe un trabajador con ese código de uniforme." };
    }
    return { error: toActionError(error, "No se pudo dar de alta al trabajador.") };
  }

  revalidatePath("/uniformes");
  return { success: "Trabajador dado de alta." };
}

export async function setUniformWorkerActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("uniformes");
  if (!gate.ok) return { error: gate.error };

  const workerId = String(formData.get("worker_id") ?? "").trim();
  const isActive = String(formData.get("is_active") ?? "") === "true";
  if (!workerId) return { error: "Trabajador requerido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("uniform_workers")
    .update({ is_active: isActive })
    .eq("id", workerId);

  if (error) {
    return { error: toActionError(error, "No se pudo cambiar el estado del personal.") };
  }

  revalidatePath("/uniformes");
  return { success: isActive ? "Trabajador activado." : "Trabajador dado de baja." };
}

export async function setUniformWorkerEmployment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("uniformes");
  if (!gate.ok) return { error: gate.error };

  const workerId = String(formData.get("worker_id") ?? "").trim();
  const employmentType =
    String(formData.get("employment_type") ?? "") === "eventual"
      ? "eventual"
      : String(formData.get("employment_type") ?? "") === "fijo"
        ? "fijo"
        : "";
  if (!workerId || !employmentType) {
    return { error: "Trabajador y tipo (fijo/eventual) son obligatorios." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("uniform_workers")
    .update({ employment_type: employmentType })
    .eq("id", workerId);

  if (error) {
    return { error: toActionError(error, "No se pudo cambiar el tipo de trabajador.") };
  }

  revalidatePath("/uniformes");
  return { success: "Tipo de trabajador actualizado." };
}

export async function markUniformUnusable(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("uniformes");
  if (!gate.ok) return { error: gate.error };

  const skuId = String(formData.get("sku_id") ?? "");
  const from = String(formData.get("from") ?? "available");
  const assignmentId = String(formData.get("assignment_id") ?? "").trim() || null;
  const qty = parsePositiveNumber(formData.get("quantity"), "Cantidad");
  const reason = parseRequiredText(formData.get("reason"), "Motivo");

  if (!skuId) return { error: "Prenda requerida." };
  if (from !== "available" && from !== "in_use") {
    return { error: "Origen inválido." };
  }
  if (!qty.ok) return { error: qty.error };
  if (!reason.ok) return { error: reason.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_uniform_unusable", {
    p_sku_id: skuId,
    p_qty: qty.value,
    p_from: from,
    p_reason: reason.value,
    p_assignment_id: assignmentId,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo marcar como no utilizable.") };
  }

  revalidatePath("/uniformes");
  revalidatePath("/reportes");
  return { success: "Marcado como no utilizable." };
}
