"use client";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  console.error(error);
  return (
    <html lang="es">
      <body className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-semibold">Algo salió mal</h1>
        <p className="mt-2 text-sm text-zinc-600">
          El sistema no pudo mostrar esta página. Intenta de nuevo.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 inline-flex min-h-10 w-fit items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
