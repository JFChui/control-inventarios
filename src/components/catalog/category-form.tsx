"use client";

import { useActionState } from "react";
import {
  createCategory,
  updateCategory,
  type ActionState,
} from "@/app/actions/catalog";

const initial: ActionState = {};

export function CategoryForm() {
  const [state, action, pending] = useActionState(createCategory, initial);

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 md:grid-cols-3">
      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="code">
          Código
        </label>
        <input
          id="code"
          name="code"
          required
          placeholder="AMEN"
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="name">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="Amenidades"
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Agregar categoría"}
        </button>
      </div>
      {state.error ? (
        <p className="text-sm text-red-700 md:col-span-3">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-700 md:col-span-3">{state.success}</p>
      ) : null}
    </form>
  );
}

export function CategoryEditForm({
  category,
}: {
  category: { id: string; code: string; name: string };
}) {
  const [state, action, pending] = useActionState(updateCategory, initial);
  const codeId = `cat-code-${category.id}`;
  const nameId = `cat-name-${category.id}`;

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={category.id} />
      <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
        <label className="sr-only" htmlFor={codeId}>
          Código
        </label>
        <input
          id={codeId}
          name="code"
          defaultValue={category.code}
          required
          className="min-h-10 rounded-md border border-zinc-300 px-3 font-mono text-sm"
        />
        <label className="sr-only" htmlFor={nameId}>
          Nombre
        </label>
        <input
          id={nameId}
          name="name"
          defaultValue={category.name}
          required
          className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 rounded-md bg-teal-800 px-3 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
        >
          {pending ? "…" : "Guardar"}
        </button>
      </div>
      {state.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-xs text-emerald-700">{state.success}</p>
      ) : null}
    </form>
  );
}
