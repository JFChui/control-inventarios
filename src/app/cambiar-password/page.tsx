import { signOut } from "@/app/actions/auth";
import { ChangePasswordForm } from "@/components/users/change-password-form";

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#e8f0ee] via-[#f3f6f5] to-[#dce8e4] px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-lg">
        <div className="bg-gradient-to-br from-teal-900 to-teal-800 px-6 py-5 text-white sm:px-8">
          <p className="text-xs font-semibold tracking-[0.16em] text-teal-200 uppercase">
            Hotel Demo
          </p>
          <h1 className="mt-2 text-xl font-semibold sm:text-2xl">
            Cambiar contraseña
          </h1>
        </div>
        <div className="space-y-4 px-6 py-6 sm:px-8 sm:pb-8">
          <p className="text-sm text-zinc-600">
            Debes actualizar tu contraseña antes de continuar.
          </p>
          <ChangePasswordForm />
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
