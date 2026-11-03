export const DEPARTMENT_FIELDS_REQUIRED = "Código y nombre son obligatorios.";
export const DEPARTMENT_CODE_TAKEN = "Ya existe un departamento con ese código.";
export const DEPARTMENT_DELETE_BLOCKED =
  "No se puede eliminar: el departamento tiene movimientos, usuarios, productos o solicitudes relacionadas. Debes desactivar el departamento.";

export function normalizeDepartmentCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function parseIsActive(
  value: string | boolean | null | undefined,
  defaultValue = true,
): boolean {
  if (value == null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "false" || normalized === "0" || normalized === "off") {
    return false;
  }
  return true;
}

export function parseDepartmentWrite(input: {
  code?: string | null;
  name?: string | null;
  isActive?: string | boolean | null;
}):
  | { ok: false; error: string }
  | { ok: true; code: string; name: string; isActive: boolean } {
  const code = normalizeDepartmentCode(String(input.code ?? ""));
  const name = String(input.name ?? "").trim();

  if (!code || !name) {
    return { ok: false, error: DEPARTMENT_FIELDS_REQUIRED };
  }

  return {
    ok: true,
    code,
    name,
    isActive: parseIsActive(input.isActive),
  };
}

export function isCodeTaken(
  existingId: string | null | undefined,
  currentId?: string | null,
): boolean {
  if (!existingId) return false;
  if (currentId && existingId === currentId) return false;
  return true;
}

export function isUniqueViolation(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === "23505";
}

export function isForeignKeyViolation(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === "23503";
}

export type DepartmentReferenceCounts = {
  movements: number;
  profiles: number;
  productDepartments: number;
  supplyRequests: number;
};

export function hasDepartmentReferences(
  counts: DepartmentReferenceCounts,
): boolean {
  return (
    counts.movements > 0 ||
    counts.profiles > 0 ||
    counts.productDepartments > 0 ||
    counts.supplyRequests > 0
  );
}
