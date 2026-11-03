"use client";

import { useActionState } from "react";
import {
  consumeReceptionLinner,
  setReceptionLimits,
  type ActionState,
} from "@/app/actions/reception";

const initial: ActionState = {};

type ProductOption = { id: string; label: string };

export function SetReceptionLimitsForm({
  products,
}: {
  products: ProductOption[];
}) {
  const [state, action, pending] = useActionState(setReceptionLimits, initial);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">Mínimo y máximo</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="product_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Producto…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <input name="min_qty" type="number" min="0" step="0.001" required placeholder="Mínimo" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="max_qty" type="number" min="0" step="0.001" required placeholder="Máximo" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

export function ConsumeReceptionForm({
  products,
}: {
  products: ProductOption[];
}) {
  const [state, action, pending] = useActionState(consumeReceptionLinner, initial);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">Registrar conteo / consumo</h3>
      <p className="text-xs text-zinc-500">
        Baja la existencia de este linner. No genera otra salida de kardex (ya salió al enviarse).
        Los blancos se mueven en Control de blancos.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="product_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Producto…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <input name="qty" type="number" min="0.001" step="0.001" required placeholder="Cantidad" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm hover:bg-zinc-50 disabled:opacity-60">
        {pending ? "Registrando…" : "Registrar"}
      </button>
    </form>
  );
}
