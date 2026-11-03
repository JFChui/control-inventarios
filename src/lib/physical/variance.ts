/**
 * Diferencia menor: hasta 5 unidades o hasta el 5% de la existencia
 * del sistema. Basta que se cumpla una de las dos.
 */
export function isMinorVariance(systemQty: number, countedQty: number) {
  const diff = Math.abs(countedQty - systemQty);
  if (diff === 0) return true;
  const pct = systemQty === 0 ? Number.POSITIVE_INFINITY : (diff / Math.abs(systemQty)) * 100;
  return diff <= 5 || pct <= 5;
}

export function classifyCountVariance(
  systemQty: number,
  countedQty: number | null,
): { label: string; className: string; diff: number | null; minor: boolean } {
  if (countedQty == null) {
    return {
      label: "Sin contar",
      className: "bg-zinc-100 text-zinc-600",
      diff: null,
      minor: false,
    };
  }
  const diff = countedQty - systemQty;
  if (diff === 0) {
    return {
      label: "Sin diferencia",
      className: "bg-emerald-50 text-emerald-800",
      diff,
      minor: true,
    };
  }
  if (isMinorVariance(systemQty, countedQty)) {
    return {
      label: "Diferencia menor",
      className: "bg-amber-50 text-amber-900",
      diff,
      minor: true,
    };
  }
  return {
    label: "Diferencia significativa",
    className: "bg-red-50 text-red-800",
    diff,
    minor: false,
  };
}
