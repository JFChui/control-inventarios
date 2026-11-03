export function uniformBalances(
  available: number,
  inUse: number,
  total: number,
  unusable = 0,
) {
  return available + inUse + unusable === total;
}
