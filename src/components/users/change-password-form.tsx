"use client";

import { useActionState } from "react";
import { changeOwnPassword, type AuthState } from "@/app/actions/auth";

const initial: AuthState = {};

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label
          htmlFor="new-password"
          className="block text-sm font-medium text-zinc-700"
        >
          Nueva contraseña
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 sm:text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="confirm-password"
          className="block text-sm font-medium text-zinc-700"
        >
          Confirmar contraseña
        </label>
        <input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 sm:text-sm"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
