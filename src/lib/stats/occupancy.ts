export const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function dailyOccupancyPct(
  occupiedDirty: number,
  occupiedClean: number,
  totalRooms: number,
): number {
  if (totalRooms <= 0) return 0;
  return Math.round(((occupiedDirty + occupiedClean) / totalRooms) * 10000) / 100;
}

export function monthKeyFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export const MONTH_NAMES_SHORT_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return yearMonth;
  return `${MONTH_NAMES_ES[month - 1]} ${year}`;
}

export function formatMonthShort(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return yearMonth;
  return `${MONTH_NAMES_SHORT_ES[month - 1]} ${String(year).slice(2)}`;
}

export function daysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export const OCCUPANCY_COLOR_STOPS = [
  { min: 90, color: "#115e59", label: "90–100%" },
  { min: 70, color: "#0f766e", label: "70–89%" },
  { min: 40, color: "#0d9488", label: "40–69%" },
  { min: 1, color: "#d97706", label: "1–39%" },
] as const;

const EMPTY_BAR_COLOR = "#d4d4d8";

/** Solid fill for occupancy bars (SVG `fill`, not CSS background). */
export function occupancyBarColor(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return EMPTY_BAR_COLOR;
  for (const stop of OCCUPANCY_COLOR_STOPS) {
    if (pct >= stop.min) return stop.color;
  }
  return EMPTY_BAR_COLOR;
}
