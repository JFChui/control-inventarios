type QueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

export function assertQuery<T>(
  result: QueryResult<T>,
  fallback = "No se pudieron cargar los datos.",
): T {
  if (result.error) {
    throw new Error(result.error.message || fallback);
  }
  return result.data;
}
