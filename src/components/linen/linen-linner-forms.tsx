"use client";

import { useActionState } from "react";
import {
  returnFromLinner,
  setLinenPiecesPerRoom,
  setLinnerPar,
  stockLinner,
  type ActionState,
} from "@/app/actions/linen";

const initial: ActionState = {};

type LinenOption = { id: string; label: string };
type LocationOption = { id: string; code: string; name: string };

function Feedback({ state }: { state: ActionState }) {
  return (
    <>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-emerald-700">{state.success}</p>
      ) : null}
    </>
  );
}

export function StockLinnerForm({
  items,
  locations,
}: {
  items: LinenOption[];
  locations: LocationOption[];
}) {
  const [state, action, pending] = useActionState(stockLinner, initial);
  if (items.length === 0) return null;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">Surtir linner</h3>
      <p className="text-xs text-zinc-500">
        Mueve lencería del almacén de lavandería a un linner. No genera kardex.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="linen_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Blanco…</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <select name="location_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Linner…</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.code} — {loc.name}</option>
          ))}
        </select>
        <input name="qty" type="number" min="0.001" step="0.001" required placeholder="Cantidad" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Surtiendo…" : "Surtir"}
      </button>
    </form>
  );
}

export function ReturnLinnerForm({
  items,
  locations,
}: {
  items: LinenOption[];
  locations: LocationOption[];
}) {
  const [state, action, pending] = useActionState(returnFromLinner, initial);
  if (items.length === 0) return null;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">Devolver a lavandería</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="linen_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Blanco…</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <select name="location_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Linner…</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.code} — {loc.name}</option>
          ))}
        </select>
        <input name="qty" type="number" min="0.001" step="0.001" required placeholder="Cantidad" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm hover:bg-zinc-50 disabled:opacity-60">
        {pending ? "Devolviendo…" : "Devolver"}
      </button>
    </form>
  );
}

export function SetLinnerParForm({
  items,
  locations,
}: {
  items: LinenOption[];
  locations: LocationOption[];
}) {
  const [state, action, pending] = useActionState(setLinnerPar, initial);
  if (items.length === 0) return null;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">Par del linner</h3>
      <p className="text-xs text-zinc-500">
        Cantidad que debería haber en el linner cuando el lencero surte.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="linen_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Blanco…</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <select name="location_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Linner…</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.code} — {loc.name}</option>
          ))}
        </select>
        <input name="par_qty" type="number" min="0" step="0.001" required placeholder="Par" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm hover:bg-zinc-50 disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar par"}
      </button>
    </form>
  );
}

export function SetPiecesPerRoomForm({ items }: { items: LinenOption[] }) {
  const [state, action, pending] = useActionState(setLinenPiecesPerRoom, initial);
  if (items.length === 0) return null;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">Piezas por habitación</h3>
      <p className="text-xs text-zinc-500">
        Sirve para calcular cuántas vueltas alcanza cada blanco para las 212 habitaciones.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="linen_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Blanco…</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <input name="pieces_per_room" type="number" min="0" step="0.001" required placeholder="Piezas / hab." className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm hover:bg-zinc-50 disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
