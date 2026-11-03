"use client";

import { useActionState } from "react";
import { createUser, type ActionState } from "@/app/actions/users";
import { RoleSelect } from "@/components/users/role-select";
import { TempPasswordAlert } from "@/components/users/temp-password-alert";

const initial: ActionState = {};

type Dept = { id: string; code: string; name: string };

export function CreateUserForm({ departments }: { departments: Dept[] }) {
  const [state, action, pending] = useActionState(createUser, initial);

  return (
    <form
      action={action}
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 md:grid-cols-2"
    >
      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="user-email">
          Correo
        </label>
        <input
          id="user-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="user-name">
          Nombre
        </label>
        <input
          id="user-name"
          name="full_name"
          required
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-700" htmlFor="user-role">
          Cargo
        </label>
        <RoleSelect id="user-role" defaultValue="floor_supervisor_a" />
      </div>
      <div>
        <label
          className="text-sm font-medium text-zinc-700"
          htmlFor="user-department"
        >
          Departamento
        </label>
        <select
          id="user-department"
          name="department_id"
          defaultValue=""
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
        >
          <option value="">Sin departamento</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear usuario"}
        </button>
      </div>
      {state.error ? (
        <p className="text-sm text-red-700 md:col-span-2" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-700 md:col-span-2">{state.success}</p>
      ) : null}
      {state.tempPassword ? (
        <TempPasswordAlert password={state.tempPassword} />
      ) : null}
    </form>
  );
}
