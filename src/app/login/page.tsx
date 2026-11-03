import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const inactive = error === "inactive";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#e8f0ee] via-[#f3f6f5] to-[#dce8e4] px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-lg">
        <div className="bg-gradient-to-br from-teal-900 to-teal-800 px-6 py-5 text-white sm:px-8">
          <p className="text-xs font-semibold tracking-[0.16em] text-teal-200 uppercase">
            Hotel Demo
          </p>
          <h1 className="mt-2 text-xl font-semibold sm:text-2xl">
            Control de inventarios
          </h1>
          <p className="mt-1 text-sm text-teal-50/90">
            Ama de Llaves · Lavandería
          </p>
        </div>
        <div className="px-6 py-6 sm:px-8 sm:pb-8">
          {inactive ? (
            <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              Tu usuario está desactivado. Contacta a un administrador.
            </p>
          ) : (
            <p className="text-sm text-zinc-600">
              Ingresa con tu usuario del sistema.
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
