import type { AppRole } from "@/lib/auth/roles";

export const PRODUCT_NOT_ENABLED =
  "Este producto no está habilitado para tu departamento.";
export const USER_DEPARTMENT_REQUIRED =
  "Tu usuario no tiene departamento asignado.";
export const STOCK_INSUFFICIENT = "Stock insuficiente para esta salida.";

export function assertDepartmentUserCanUseProduct(input: {
  role: AppRole | null | undefined;
  userDepartmentId: string | null | undefined;
  productDepartmentIds: string[];
}): { ok: true } | { ok: false; error: string } {
  if (input.role !== "department_user") {
    return { ok: true };
  }
  if (!input.userDepartmentId) {
    return { ok: false, error: USER_DEPARTMENT_REQUIRED };
  }
  if (!input.productDepartmentIds.includes(input.userDepartmentId)) {
    return { ok: false, error: PRODUCT_NOT_ENABLED };
  }
  return { ok: true };
}

export function diffDepartmentAssignments(
  currentIds: string[],
  desiredIds: string[],
): { toDelete: string[]; toInsert: string[] } {
  const current = new Set(currentIds);
  const desired = new Set(desiredIds.filter(Boolean));
  return {
    toDelete: [...current].filter((id) => !desired.has(id)),
    toInsert: [...desired].filter((id) => !current.has(id)),
  };
}

export function assertOutboundStock(
  movementType: "in" | "out",
  quantity: number,
  quantityOnHand: number,
): { ok: true } | { ok: false; error: string } {
  if (movementType !== "out") return { ok: true };
  if (quantityOnHand >= quantity) return { ok: true };
  return { ok: false, error: STOCK_INSUFFICIENT };
}
