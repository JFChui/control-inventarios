"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import { createClient } from "@/lib/supabase/server";
import {
  DEPARTMENT_CODE_TAKEN,
  DEPARTMENT_DELETE_BLOCKED,
  hasDepartmentReferences,
  isCodeTaken,
  isForeignKeyViolation,
  isUniqueViolation,
  parseDepartmentWrite,
  type DepartmentReferenceCounts,
} from "@/lib/departments/rules";

export type ActionState = {
  error?: string;
  success?: string;
};

const FORBIDDEN = "No tienes permiso para gestionar departamentos.";

function revalidateDepartments() {
  revalidatePath("/departamentos");
  revalidatePath("/usuarios");
}

async function requireDepartmentManager() {
  const gate = await requireModuleAction("departamentos");
  if (!gate.ok) {
    return { error: gate.error, supabase: null };
  }
  const supabase = await createClient();
  return { error: null, supabase };
}

async function findDepartmentIdByCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  code: string,
) {
  const { data } = await supabase
    .from("departments")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return data?.id ?? null;
}

async function countDepartmentReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<{ counts?: DepartmentReferenceCounts; error?: string }> {
  const [movements, profiles, productDepartments, supplyRequests] =
    await Promise.all([
      supabase
        .from("stock_movements")
        .select("id", { count: "exact", head: true })
        .eq("department_id", id),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("department_id", id),
      supabase
        .from("product_departments")
        .select("product_id", { count: "exact", head: true })
        .eq("department_id", id),
      supabase
        .from("supply_requests")
        .select("id", { count: "exact", head: true })
        .eq("department_id", id),
    ]);

  const failed =
    movements.error ??
    profiles.error ??
    productDepartments.error ??
    supplyRequests.error;
  if (failed) {
    return {
      error: toActionError(
        failed,
        "No se pudieron comprobar las referencias del departamento.",
      ),
    };
  }

  return {
    counts: {
      movements: movements.count ?? 0,
      profiles: profiles.count ?? 0,
      productDepartments: productDepartments.count ?? 0,
      supplyRequests: supplyRequests.count ?? 0,
    },
  };
}

export async function createDepartment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireDepartmentManager();
  if (gate.error || !gate.supabase) return { error: gate.error ?? FORBIDDEN };

  const parsed = parseDepartmentWrite({
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const existingId = await findDepartmentIdByCode(gate.supabase, parsed.code);
  if (isCodeTaken(existingId)) {
    return { error: DEPARTMENT_CODE_TAKEN };
  }

  const { error } = await gate.supabase.from("departments").insert({
    code: parsed.code,
    name: parsed.name,
    is_active: true,
  });

  if (error) {
    if (isUniqueViolation(error)) return { error: DEPARTMENT_CODE_TAKEN };
    return { error: toActionError(error, "No se pudo crear el departamento.") };
  }

  revalidateDepartments();
  return { success: "Departamento creado." };
}

export async function updateDepartment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireDepartmentManager();
  if (gate.error || !gate.supabase) return { error: gate.error ?? FORBIDDEN };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Departamento requerido." };

  const parsed = parseDepartmentWrite({
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    isActive: String(formData.get("is_active") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const existingId = await findDepartmentIdByCode(gate.supabase, parsed.code);
  if (isCodeTaken(existingId, id)) {
    return { error: DEPARTMENT_CODE_TAKEN };
  }

  const { error } = await gate.supabase
    .from("departments")
    .update({
      code: parsed.code,
      name: parsed.name,
      is_active: parsed.isActive,
    })
    .eq("id", id);

  if (error) {
    if (isUniqueViolation(error)) return { error: DEPARTMENT_CODE_TAKEN };
    return { error: toActionError(error, "No se pudo actualizar el departamento.") };
  }

  revalidateDepartments();
  return { success: "Departamento actualizado." };
}

export async function deactivateDepartment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireDepartmentManager();
  if (gate.error || !gate.supabase) return { error: gate.error ?? FORBIDDEN };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Departamento requerido." };

  const { error } = await gate.supabase
    .from("departments")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return { error: toActionError(error, "No se pudo desactivar el departamento.") };
  }

  revalidateDepartments();
  return { success: "Departamento desactivado." };
}

export async function deleteDepartment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireDepartmentManager();
  if (gate.error || !gate.supabase) return { error: gate.error ?? FORBIDDEN };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Departamento requerido." };

  const counted = await countDepartmentReferences(gate.supabase, id);
  if (counted.error) return { error: counted.error };
  if (!counted.counts || hasDepartmentReferences(counted.counts)) {
    return { error: DEPARTMENT_DELETE_BLOCKED };
  }

  const { error } = await gate.supabase.from("departments").delete().eq("id", id);

  if (error) {
    if (isForeignKeyViolation(error)) {
      return { error: DEPARTMENT_DELETE_BLOCKED };
    }
    return { error: toActionError(error, "No se pudo eliminar el departamento.") };
  }

  revalidateDepartments();
  return { success: "Departamento eliminado." };
}
