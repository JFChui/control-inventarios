"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "@/app/actions/auth";

const initial: AuthState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 sm:text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-700"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
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
        {pending ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
