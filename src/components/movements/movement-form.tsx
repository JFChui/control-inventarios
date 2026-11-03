"use client";

import { useActionState, useState } from "react";
import { createMovement, type MovementState } from "@/app/actions/movements";

const initial: MovementState = {};

type Product = {
  id: string;
  code: string;
  name: string;
  quantity_on_hand: number;
  category_id: string;
};
type Department = { id: string; code: string; name: string };
type Category = { id: string; code: string; name: string };
type ReceptionHint = { productId: string; toBring: number };

export function MovementForm({
  products,
  departments,
  categories,
  lockDepartmentId,
  receptionHints = [],
}: {
  products: Product[];
  departments: Department[];
  categories: Category[];
  lockDepartmentId?: string | null;
  receptionHints?: ReceptionHint[];
}) {
  const [state, action, pending] = useActionState(createMovement, initial);
  const [categoryId, setCategoryId] = useState("");
  const [toReception, setToReception] = useState(false);
  const [productId, setProductId] = useState("");
  const filteredProducts = categoryId
    ? products.filter((p) => p.category_id === categoryId)
    : products;
  const lockedDepartment = lockDepartmentId
    ? departments.find((d) => d.id === lockDepartmentId)
    : null;
  const hint = receptionHints.find((row) => row.productId === productId);
  const suggested = hint && hint.toBring > 0 ? hint.toBring : null;

  return (
    <form action={action} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium" htmlFor="movement_type">
            Tipo
          </label>
          <select
            id="movement_type"
            name="movement_type"
            required
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
            defaultValue={toReception ? "out" : "in"}
            disabled={toReception}
          >
            <option value="in">Entrada</option>
            <option value="out">Salida</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="category_filter">
            Categoría
          </label>
          <select
            id="category_filter"
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="product_id">
            Producto
          </label>
          <select
            id="product_id"
            name="product_id"
            required
            key={categoryId}
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {filteredProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name} (stock {p.quantity_on_hand})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="quantity">
            Cantidad
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="0.001"
            step="0.001"
            required
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
            defaultValue={suggested ?? undefined}
            key={`${productId}-${toReception}-${suggested ?? "none"}`}
          />
          {toReception && suggested != null ? (
            <p className="mt-1 text-xs text-zinc-500">
              Sugerido para llegar al máximo del linner: {suggested}
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="destination"
              value="reception_linner"
              checked={toReception}
              onChange={(e) => setToReception(e.target.checked)}
            />
            Enviar al linner de recepción
          </label>
        </div>
        {toReception ? <input type="hidden" name="movement_type" value="out" /> : null}
        <div>
          <label className="text-sm font-medium" htmlFor="department_id">
            Departamento{lockDepartmentId ? "" : " (opcional)"}
          </label>
          {lockDepartmentId ? (
            <>
              <input type="hidden" name="department_id" value={lockDepartmentId} />
              <p className="mt-1 flex min-h-11 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {lockedDepartment
                  ? `${lockedDepartment.code} — ${lockedDepartment.name}`
                  : "Tu departamento"}
              </p>
            </>
          ) : (
            <select
              id="department_id"
              name="department_id"
              className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
              defaultValue=""
            >
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="supplier">
            Proveedor (entradas)
          </label>
          <input
            id="supplier"
            name="supplier"
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="reason">
            Motivo
          </label>
          <input
            id="reason"
            name="reason"
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="notes">
            Notas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
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
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Registrando…" : "Registrar movimiento"}
      </button>
    </form>
  );
}
