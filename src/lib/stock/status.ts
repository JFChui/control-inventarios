export type StockStatus =
  | "sin_conteo"
  | "agotado"
  | "bajo"
  | "proximo"
  | "normal";

export const STOCK_STATUS_UI: Record<
  StockStatus,
  { label: string; className: string }
> = {
  sin_conteo: { label: "Sin conteo", className: "bg-zinc-100 text-zinc-700" },
  agotado: { label: "Agotado", className: "bg-zinc-900 text-white" },
  bajo: { label: "Bajo", className: "bg-amber-100 text-amber-900" },
  proximo: { label: "Próximo", className: "bg-yellow-50 text-yellow-900" },
  normal: { label: "Normal", className: "bg-emerald-50 text-emerald-800" },
};

export function isInventoryInitialized(
  value: string | null | undefined,
): boolean {
  return value != null && value !== "";
}

export function classifyStock(
  quantityOnHand: number,
  minStock: number,
  initialized = true,
): StockStatus {
  if (!initialized) return "sin_conteo";
  if (quantityOnHand <= 0) return "agotado";
  if (minStock <= 0) return "normal";
  if (quantityOnHand <= minStock) return "bajo";
  if (quantityOnHand <= minStock * 1.25) return "proximo";
  return "normal";
}

export function stockBadge(
  quantityOnHand: number,
  minStock: number,
  initialized = true,
  isActive = true,
): { label: string; className: string; status: StockStatus | "inactivo" } {
  if (!isActive) {
    return {
      label: "Inactivo",
      className: "bg-zinc-200 text-zinc-700",
      status: "inactivo",
    };
  }
  const status = classifyStock(quantityOnHand, minStock, initialized);
  return { ...STOCK_STATUS_UI[status], status };
}
