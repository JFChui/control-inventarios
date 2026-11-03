const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function rawString(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).trim();
}

export function parseRequiredText(
  raw: unknown,
  label: string,
  max = 200,
): ParseResult<string> {
  const value = rawString(raw);
  if (!value) return { ok: false, error: `${label} es obligatorio.` };
  if (value.length > max) {
    return { ok: false, error: `${label} no puede superar ${max} caracteres.` };
  }
  return { ok: true, value };
}

export function parseOptionalText(
  raw: unknown,
  label: string,
  max = 500,
): ParseResult<string | null> {
  const value = rawString(raw);
  if (!value) return { ok: true, value: null };
  if (value.length > max) {
    return { ok: false, error: `${label} no puede superar ${max} caracteres.` };
  }
  return { ok: true, value };
}

export function parsePositiveNumber(
  raw: unknown,
  label: string,
): ParseResult<number> {
  const text = rawString(raw);
  if (text === "") {
    return { ok: false, error: `Indica ${label}.` };
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: `${label} debe ser mayor a 0.` };
  }
  return { ok: true, value };
}

export function parseNonNegativeNumber(
  raw: unknown,
  label: string,
): ParseResult<number> {
  const text = rawString(raw);
  if (text === "") {
    return { ok: false, error: `Indica ${label}.` };
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: `${label} debe ser un número mayor o igual a 0.` };
  }
  return { ok: true, value };
}

export function parseIsoDate(raw: unknown, label = "Fecha"): ParseResult<string> {
  const value = rawString(raw);
  if (!ISO_DATE.test(value)) {
    return { ok: false, error: `${label} inválida.` };
  }
  return { ok: true, value };
}
