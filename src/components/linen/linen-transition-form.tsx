"use client";

import { useActionState } from "react";
import { transitionLinen, type ActionState } from "@/app/actions/linen";

const initial: ActionState = {};

const STATES = [
  { value: "available", label: "Disponible" },
  { value: "in_use", label: "En uso" },
  { value: "in_laundry", label: "En lavandería" },
  { value: "damaged", label: "Dañado" },
  { value: "written_off", label: "Baja" },
] as const;

type LinenOption = { id: string; label: string };
type LocationOption = { id: string; code: string; name: string };

export function LinenTransitionForm({
  items,
  locations,
}: {
  items: LinenOption[];
  locations: LocationOption[];
}) {
  const [state, action, pending] = useActionState(transitionLinen, initial);

  if (items.length === 0) return null;

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <h2 className="text-lg font-semibold">Mover entre estados</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="text-sm font-medium" htmlFor="linen_id">
            Blanco
          </label>
          <select
            id="linen_id"
            name="linen_id"
            required
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="from">
            Desde
          </label>
          <select
            id="from"
            name="from"
            required
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
            defaultValue="available"
          >
            {STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="to">
            Hacia
          </label>
          <select
            id="to"
            name="to"
            required
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
            defaultValue="in_use"
          >
            {STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="location_id">
            Linner (si sale de disponible)
          </label>
          <select
            id="location_id"
            name="location_id"
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
            defaultValue=""
          >
            <option value="">Almacén lavandería</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code} — {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="qty">
            Cantidad
          </label>
          <input
            id="qty"
            name="qty"
            type="number"
            min="0.001"
            step="0.001"
            required
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
          />
        </div>
      </div>

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-emerald-700">{state.success}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {pending ? "Moviendo…" : "Aplicar transición"}
      </button>
    </form>
  );
}
