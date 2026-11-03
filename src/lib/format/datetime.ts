export const HOTEL_TIME_ZONE = "America/Caracas";
export const HOTEL_LOCALE = "es-VE";

function hotelDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return { year, month, day };
}

export function hotelToday(now = new Date()): string {
  const { year, month, day } = hotelDateParts(now);
  return `${year}-${month}-${day}`;
}

export function hotelMonth(now = new Date()): string {
  const { year, month } = hotelDateParts(now);
  return `${year}-${month}`;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(HOTEL_LOCALE, {
    timeZone: HOTEL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(HOTEL_LOCALE, {
    timeZone: HOTEL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPrintDate(now = new Date()): string {
  return now.toLocaleDateString(HOTEL_LOCALE, {
    timeZone: HOTEL_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
