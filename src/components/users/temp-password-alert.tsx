"use client";

import { useState } from "react";

export function TempPasswordAlert({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
  }

  return (
    <div
      role="status"
      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 md:col-span-2"
    >
      <p className="font-medium">
        Contraseña temporal — cópiala ahora; no se volverá a mostrar.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-white px-2 py-1 font-mono text-sm">
          {password}
        </code>
        <button
          type="button"
          onClick={copy}
          className="min-h-9 rounded-md border border-amber-300 bg-white px-3 text-xs font-medium text-amber-950 hover:bg-amber-100"
        >
          {copied ? "Copiada" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
