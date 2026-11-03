"use client";

import { useActionState } from "react";
import {
  resetUserPassword,
  updateProfile,
  type ActionState,
} from "@/app/actions/users";
import { RoleSelect } from "@/components/users/role-select";
import { TempPasswordAlert } from "@/components/users/temp-password-alert";
import type { AppRole } from "@/lib/auth/roles";

const initial: ActionState = {};

type Dept = { id: string; code: string; name: string };

export function ProfileEditForm({
  profile,
  departments,
  currentUserId,
}: {
  profile: {
    id: string;
    full_name: string | null;
    role: AppRole;
    department_id: string | null;
    is_active: boolean;
  };
  departments: Dept[];
  currentUserId: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  const isSelf = currentUserId === profile.id;
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={profile.id} />
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            name="full_name"
            defaultValue={profile.full_name ?? ""}
            placeholder="Nombre"
            aria-label="Nombre"
            className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <RoleSelect defaultValue={profile.role} />
          <select
            name="department_id"
            defaultValue={profile.department_id ?? ""}
            aria-label="Departamento"
            className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
          >
            <option value="">Sin departamento</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-9 items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={profile.is_active}
            className="size-4 rounded border-zinc-300"
          />
          Activo
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="min-h-9 rounded-md bg-teal-800 px-3 text-xs font-medium text-white hover:bg-teal-900 disabled:opacity-60"
          >
            {pending ? "…" : "Guardar"}
          </button>
          {state.error ? (
            <span className="text-xs text-red-700" role="alert">
              {state.error}
            </span>
          ) : null}
          {state.success ? (
            <span className="text-xs text-emerald-700">{state.success}</span>
          ) : null}
        </div>
      </form>
      {isSelf ? null : <ResetPasswordButton userId={profile.id} />}
    </div>
  );
}

function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resetUserPassword, initial);
  return (
    <form
      action={action}
      className="space-y-2"
      onSubmit={(event) => {
        if (
          !window.confirm(
            "¿Restablecer la contraseña? Se generará una clave temporal de un solo uso.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-9 rounded-md border border-amber-300 bg-white px-3 text-xs font-medium text-amber-950 hover:bg-amber-50 disabled:opacity-60"
      >
        {pending ? "…" : "Restablecer contraseña"}
      </button>
      {state.error ? (
        <p className="text-xs text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-xs text-emerald-700">{state.success}</p>
      ) : null}
      {state.tempPassword ? (
        <TempPasswordAlert password={state.tempPassword} />
      ) : null}
    </form>
  );
}
