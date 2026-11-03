export function linenTurns(
  available: number,
  inUse: number,
  inLaundry: number,
  totalRooms: number,
  piecesPerRoom: number,
): number | null {
  if (!(totalRooms > 0) || !(piecesPerRoom > 0)) return null;
  return (available + inUse + inLaundry) / (totalRooms * piecesPerRoom);
}

export function formatTurns(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}
