export const CATEGORY_FIELDS_REQUIRED = "Código y nombre son obligatorios.";
export const CATEGORY_CODE_TAKEN = "Ya existe una categoría con ese código.";
export const CATEGORY_ID_REQUIRED = "Categoría requerida.";
export const PRODUCT_FIELDS_REQUIRED =
  "Completa código, nombre, categoría y unidad.";
export const PRODUCT_CODE_TAKEN = "Ya existe un producto con ese código.";
export const PRODUCT_ID_REQUIRED = "Producto requerido.";
export const PRODUCT_MIN_STOCK_INVALID = "Stock mínimo inválido.";
export const PRODUCT_DEPARTMENT_SYNC_FAILED =
  "No se pudieron guardar los departamentos del producto. Intenta de nuevo.";
export const BULK_CATEGORY_REQUIRED = "Elige una categoría.";
export const BULK_FIELDS_REQUIRED =
  "Indica un stock mínimo y/o una unidad para aplicar.";
export const BULK_UNIT_INVALID = "Unidad inválida.";

export function isUniqueViolation(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === "23505";
}

export function isCodeTaken(
  existingId: string | null | undefined,
  currentId?: string | null,
): boolean {
  if (!existingId) return false;
  if (currentId && existingId === currentId) return false;
  return true;
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

function uniqueIds(ids: string[] | null | undefined): string[] {
  return [...new Set((ids ?? []).map(String).map((id) => id.trim()).filter(Boolean))];
}

export function parseCategoryWrite(input: {
  id?: string | null;
  code?: string | null;
  name?: string | null;
}):
  | { ok: false; error: string }
  | { ok: true; id: string | null; code: string; name: string } {
  const id = String(input.id ?? "").trim() || null;
  const code = String(input.code ?? "")
    .trim()
    .toUpperCase();
  const name = String(input.name ?? "").trim();

  if (!code || !name) {
    return { ok: false, error: CATEGORY_FIELDS_REQUIRED };
  }

  return { ok: true, id, code, name };
}

export function parseProductWrite(
  input: {
    id?: string | null;
    code?: string | null;
    name?: string | null;
    categoryId?: string | null;
    unit?: string | null;
    minStock?: string | number | null;
    isActive?: string | boolean | null;
    departmentIds?: string[] | null;
  },
  options?: { requireId?: boolean },
):
  | { ok: false; error: string }
  | {
      ok: true;
      id: string | null;
      code: string;
      name: string;
      categoryId: string;
      unit: string;
      minStock: number;
      isActive: boolean;
      departmentIds: string[];
    } {
  const id = String(input.id ?? "").trim() || null;
  if (options?.requireId && !id) {
    return { ok: false, error: PRODUCT_ID_REQUIRED };
  }

  const code = String(input.code ?? "")
    .trim()
    .toUpperCase();
  const name = String(input.name ?? "").trim();
  const categoryId = String(input.categoryId ?? "").trim();
  const unit = String(input.unit ?? "").trim();
  const minStock = Number(input.minStock ?? 0);

  if (!code || !name || !categoryId || !unit) {
    return { ok: false, error: PRODUCT_FIELDS_REQUIRED };
  }
  if (Number.isNaN(minStock) || minStock < 0) {
    return { ok: false, error: PRODUCT_MIN_STOCK_INVALID };
  }

  return {
    ok: true,
    id,
    code,
    name,
    categoryId,
    unit,
    minStock,
    isActive: parseIsActive(input.isActive, true),
    departmentIds: uniqueIds(input.departmentIds),
  };
}

export function parseBulkMinUnit(input: {
  categoryId?: string | null;
  departmentId?: string | null;
  minStock?: string | number | null;
  unit?: string | null;
}):
  | { ok: false; error: string }
  | {
      ok: true;
      categoryId: string;
      departmentId: string | null;
      minStock: number | null;
      unit: string | null;
    } {
  const categoryId = String(input.categoryId ?? "").trim();
  const departmentId = String(input.departmentId ?? "").trim() || null;
  const unitRaw = String(input.unit ?? "").trim();
  const minRaw = input.minStock;
  const minBlank =
    minRaw == null || (typeof minRaw === "string" && minRaw.trim() === "");

  if (!categoryId) {
    return { ok: false, error: BULK_CATEGORY_REQUIRED };
  }

  let minStock: number | null = null;
  if (!minBlank) {
    minStock = Number(minRaw);
    if (Number.isNaN(minStock) || minStock < 0) {
      return { ok: false, error: PRODUCT_MIN_STOCK_INVALID };
    }
  }

  const unit = unitRaw || null;
  if (unit && unit.length > 32) {
    return { ok: false, error: BULK_UNIT_INVALID };
  }

  if (minStock == null && !unit) {
    return { ok: false, error: BULK_FIELDS_REQUIRED };
  }

  return { ok: true, categoryId, departmentId, minStock, unit };
}
