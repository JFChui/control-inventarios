export const SOURCE_TYPE_LABELS: Record<string, string> = {
  manual: "Manual",
  request: "Solicitud",
  maid_allocation: "Dotación",
  physical_count: "Inventario físico",
  linen: "Blancos",
  reception_linner: "Linner recepción",
};

export const ALLOCATION_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
};

export function sourceTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return SOURCE_TYPE_LABELS[value] ?? value;
}

export function allocationStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ALLOCATION_STATUS_LABELS[value] ?? value;
}
