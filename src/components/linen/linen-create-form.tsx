"use client";

import { useActionState } from "react";
import { createLinenItem, type ActionState } from "@/app/actions/linen";

const initial: ActionState = {};

type Product = { id: string; code: string; name: string };

export function LinenCreateForm({ products }: { products: Product[] }) {
  const [state, action, pending] = useActionState(createLinenItem, initial);

  if (products.length === 0) {
    return (
      <p className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        Todos los productos activos ya están registrados como blancos, o no hay
        catálogo disponible.
      </p>
    );
  }

  return (
    <form
      action={action}
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <p className="text-sm text-zinc-600">
        El disponible inicial copia la existencia del producto. Así el control
        de blancos no se separa del stock.
      </p>
      <div>
        <label className="text-sm font-medium" htmlFor="product_id">
          Producto
        </label>
        <select
          id="product_id"
          name="product_id"
          required
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Selecciona…
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </div>
      {state.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-700">{state.success}</p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Registrar blanco"}
        </button>
      </div>
    </form>
  );
}
