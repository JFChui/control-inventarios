"use client";

import { useActionState } from "react";
import {
  createDepartment,
  deactivateDepartment,
  deleteDepartment,
  updateDepartment,
  type ActionState,
} from "@/app/actions/departments";

const initial: ActionState = {};

export function DepartmentCreateForm() {
  const [state, action, pending] = useActionState(createDepartment, initial);

  return (
    <form
      action={action}
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 md:grid-cols-3"
    >
      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="dept-code">
          Código
        </label>
        <input
          id="dept-code"
          name="code"
          required
          placeholder="AMA"
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="dept-name">
          Nombre
        </label>
        <input
          id="dept-name"
          name="name"
          required
          placeholder="Ama de Llaves"
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Agregar departamento"}
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

export function DepartmentEditForm({
  department,
}: {
  department: {
    id: string;
    code: string;
    name: string;
    is_active: boolean;
  };
}) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateDepartment,
    initial,
  );
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    deactivateDepartment,
    initial,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteDepartment,
    initial,
  );

  const feedback = updateState.error
    ? { error: updateState.error }
    : deactivateState.error
      ? { error: deactivateState.error }
      : deleteState.error
        ? { error: deleteState.error }
        : updateState.success
          ? { success: updateState.success }
          : deactivateState.success
            ? { success: deactivateState.success }
            : deleteState.success
              ? { success: deleteState.success }
              : {};

  return (
    <div className="space-y-3">
      <form action={updateAction} className="space-y-2">
        <input type="hidden" name="id" value={department.id} />
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            name="code"
            defaultValue={department.code}
            placeholder="Código"
            required
            className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <input
            name="name"
            defaultValue={department.name}
            placeholder="Nombre"
            required
            className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <select
            name="is_active"
            defaultValue={department.is_active ? "true" : "false"}
            className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={updatePending}
            className="min-h-9 rounded-md bg-teal-800 px-3 text-xs font-medium text-white hover:bg-teal-900 disabled:opacity-60"
          >
            {updatePending ? "…" : "Guardar"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {department.is_active ? (
          <form action={deactivateAction}>
            <input type="hidden" name="id" value={department.id} />
            <button
              type="submit"
              disabled={deactivatePending}
              className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            >
              {deactivatePending ? "…" : "Desactivar"}
            </button>
          </form>
        ) : null}
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm("¿Eliminar este departamento? Esta acción no se puede deshacer.")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={department.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="min-h-9 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {deletePending ? "…" : "Eliminar"}
          </button>
        </form>
        {feedback.error ? (
          <span className="text-xs text-red-700">{feedback.error}</span>
        ) : null}
        {feedback.success ? (
          <span className="text-xs text-emerald-700">{feedback.success}</span>
        ) : null}
      </div>
    </div>
  );
}
