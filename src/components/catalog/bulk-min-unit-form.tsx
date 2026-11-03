"use client";

import { useActionState } from "react";
import {
  bulkUpdateMinAndUnit,
  type ActionState,
} from "@/app/actions/catalog";

const initial: ActionState = {};

export function BulkMinUnitForm({
  categories,
  departments,
}: {
  categories: { id: string; code: string; name: string }[];
  departments: { id: string; code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(bulkUpdateMinAndUnit, initial);

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Categoría</span>
          <select
            name="category_id"
            required
            defaultValue=""
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-base sm:text-sm"
          >
            <option value="" disabled>
              Elige una categoría
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.code} — {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Departamento (opcional)</span>
          <select
            name="department_id"
            defaultValue=""
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-base sm:text-sm"
          >
            <option value="">Todos los habilitados en la categoría</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.code} — {department.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Stock mínimo</span>
          <input
            name="min_stock"
            type="number"
            min="0"
            step="0.001"
            placeholder="Dejar vacío para no cambiar"
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base sm:text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Unidad</span>
          <input
            name="unit"
            placeholder="GAL, CAJA, PAQ, UND…"
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base sm:text-sm"
          />
        </label>
      </div>
      <p className="text-sm text-zinc-600">
        Se aplica a productos <strong>activos</strong> del alcance. No toca
        existencias ni códigos. Indica mínimo, unidad o ambos. Mínimo 0 =
        umbral no configurado (no genera alerta de bajo/próximo).
      </p>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {pending ? "Aplicando…" : "Aplicar a productos activos"}
      </button>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-emerald-700">{state.success}</p>
      ) : null}
    </form>
  );
}
