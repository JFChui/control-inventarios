export default function AppLoading() {
  return (
    <div className="space-y-3 p-1" aria-live="polite">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
      <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
      <p className="text-sm text-zinc-500">Cargando…</p>
    </div>
  );
}
