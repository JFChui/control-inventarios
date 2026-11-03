"use client";

import { useActionState } from "react";
import {
  createProduct,
  updateProduct,
  type ActionState,
} from "@/app/actions/catalog";

const initialState: ActionState = {};

type Category = { id: string; code: string; name: string };
type Department = { id: string; code: string; name: string };

export type ProductFormInitial = {
  id: string;
  code: string;
  name: string;
  category_id: string;
  unit: string;
  min_stock: number;
  is_active: boolean;
  department_ids: string[];
};

export function ProductForm({
  categories,
  departments,
  initial,
}: {
  categories: Category[];
  departments: Department[];
  initial?: ProductFormInitial;
}) {
  const action = initial ? updateProduct : createProduct;
  const [state, formAction, pending] = useActionState(action, initialState);
  const selected = new Set(initial?.department_ids ?? []);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
    >
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium" htmlFor="code">
            Código
          </label>
          <input
            id="code"
            name="code"
            required
            placeholder="AM-003"
            defaultValue={initial?.code}
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="name">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Acondicionador"
            defaultValue={initial?.name}
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="category_id">
            Categoría
          </label>
          <select
            id="category_id"
            name="category_id"
            required
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
            defaultValue={initial?.category_id ?? ""}
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="unit">
            Unidad
          </label>
          <input
            id="unit"
            name="unit"
            required
            placeholder="unidad / litro / caja"
            defaultValue={initial?.unit}
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="min_stock">
            Stock mínimo
          </label>
          <input
            id="min_stock"
            name="min_stock"
            type="number"
            min="0"
            step="0.001"
            defaultValue={initial?.min_stock ?? 0}
            required
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
          />
        </div>
        {initial ? (
          <div>
            <label className="text-sm font-medium" htmlFor="is_active">
              Estado
            </label>
            <select
              id="is_active"
              name="is_active"
              defaultValue={initial.is_active ? "true" : "false"}
              className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        ) : null}
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Departamentos habilitados</legend>
        <p className="mt-1 text-xs text-zinc-500">
          Un usuario de departamento solo podrá mover este producto si está marcado.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {departments.map((d) => (
            <label
              key={d.id}
              className="flex min-h-11 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm"
            >
              <input
                type="checkbox"
                name="department_ids"
                value={d.id}
                defaultChecked={selected.has(d.id)}
                className="size-4 rounded border-zinc-300"
              />
              <span>
                <span className="font-mono text-xs text-zinc-500">{d.code}</span>{" "}
                {d.name}
              </span>
            </label>
          ))}
          {departments.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay departamentos.</p>
          ) : null}
        </div>
      </fieldset>

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-emerald-700">{state.success}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Guardando…" : initial ? "Guardar cambios" : "Crear producto"}
      </button>
    </form>
  );
}
