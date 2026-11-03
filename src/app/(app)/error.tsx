"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-950">
      <h2 className="text-lg font-semibold">No se pudo cargar esta pantalla</h2>
      <p className="mt-2 text-sm">
        Intenta de nuevo. Si el problema continúa, avisa a sistemas.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 inline-flex min-h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
      >
        Reintentar
      </button>
    </div>
  );
}
