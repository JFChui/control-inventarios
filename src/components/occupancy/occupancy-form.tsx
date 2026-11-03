"use client";

import { useActionState, useMemo, useState } from "react";
import {
  updateHotelRooms,
  upsertDailyOccupancy,
  type ActionState,
} from "@/app/actions/occupancy";
import { dailyOccupancyPct } from "@/lib/stats/occupancy";

const initial: ActionState = {};

export function HotelRoomsForm({ totalRooms }: { totalRooms: number }) {
  const [state, action, pending] = useActionState(updateHotelRooms, initial);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">Total de habitaciones del hotel</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-zinc-500" htmlFor="total_rooms">
            Habitaciones
          </label>
          <input
            id="total_rooms"
            name="total_rooms"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={totalRooms}
            className="mt-1 min-h-11 w-32 rounded-md border border-zinc-300 px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar total"}
        </button>
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
    </form>
  );
}

export function DailyOccupancyForm({
  totalRooms,
  today,
}: {
  totalRooms: number;
  today: string;
}) {
  const [state, action, pending] = useActionState(upsertDailyOccupancy, initial);
  const [dirty, setDirty] = useState(0);
  const [clean, setClean] = useState(0);
  const pct = useMemo(
    () => dailyOccupancyPct(dirty, clean, totalRooms),
    [dirty, clean, totalRooms],
  );

  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">Registrar ocupación diaria</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-xs text-zinc-500" htmlFor="occupancy_date">
            Fecha
          </label>
          <input
            id="occupancy_date"
            name="occupancy_date"
            type="date"
            required
            defaultValue={today}
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500" htmlFor="occupied_dirty">
            Ocupadas dirty
          </label>
          <input
            id="occupied_dirty"
            name="occupied_dirty"
            type="number"
            min="0"
            step="1"
            required
            value={dirty}
            onChange={(e) => setDirty(Number(e.target.value) || 0)}
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500" htmlFor="occupied_clean">
            Ocupadas clean
          </label>
          <input
            id="occupied_clean"
            name="occupied_clean"
            type="number"
            min="0"
            step="1"
            required
            value={clean}
            onChange={(e) => setClean(Number(e.target.value) || 0)}
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500" htmlFor="notes">
            Notas
          </label>
          <input
            id="notes"
            name="notes"
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm"
          />
        </div>
      </div>
      <p className="text-sm text-zinc-700">
        Ocupación calculada:{" "}
        <span className="font-semibold tabular-nums">{pct}%</span>
        <span className="text-zinc-500">
          {" "}
          ({dirty + clean} de {totalRooms} habitaciones)
        </span>
      </p>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar ocupación del día"}
      </button>
    </form>
  );
}
