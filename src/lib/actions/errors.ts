const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

type MaybePgError = {
  code?: string | null;
  message?: string | null;
};

function asPgError(error: unknown): MaybePgError {
  if (typeof error === "object" && error !== null) {
    const record = error as { code?: unknown; message?: unknown };
    return {
      code: typeof record.code === "string" ? record.code : null,
      message: typeof record.message === "string" ? record.message : null,
    };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: typeof error === "string" ? error : null };
}

export function stripIds(message: string): string {
  return message.replace(UUID_RE, "").replace(/\s{2,}/g, " ").trim();
}

export function toActionError(error: unknown, fallback: string): string {
  console.error(error);
  const { code, message } = asPgError(error);

  if (code === "23505") return "Ya existe un registro con esos datos.";
  if (code === "23503") return "No se puede completar: hay datos relacionados.";
  if (code === "42501") return "No tienes permiso para esta operación.";

  if (message) {
    const cleaned = stripIds(message);
    if (cleaned) return cleaned;
  }
  return fallback;
}
