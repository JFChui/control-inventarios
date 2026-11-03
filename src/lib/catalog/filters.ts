export type InventoryFilters = {
  q: string;
  category: string;
  department: string;
  status: string;
  activeOnly: boolean;
};

const STATUS_VALUES = new Set([
  "sin_conteo",
  "agotado",
  "bajo",
  "proximo",
  "normal",
  "inactivo",
]);

export function parseInventoryFilters(sp: {
  q?: string;
  category?: string;
  department?: string;
  status?: string;
  activos?: string;
}): InventoryFilters {
  const status = String(sp.status ?? "").trim();
  const activos = sp.activos ?? "1";
  return {
    q: String(sp.q ?? "").trim(),
    category: String(sp.category ?? "").trim(),
    department: String(sp.department ?? "").trim(),
    status: STATUS_VALUES.has(status) ? status : "",
    activeOnly:
      status === "inactivo"
        ? false
        : activos !== "0" && activos !== "all",
  };
}

export function sanitizeIlike(value: string) {
  return value.replace(/[%_,()]/g, "").trim();
}
