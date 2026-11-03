/** Variación porcentual del mes actual contra el anterior. Null si no hay base. */
export function monthlyVariationPct(current: number, previous: number | null) {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
