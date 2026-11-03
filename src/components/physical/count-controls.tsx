"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createPhysicalCount,
  postPhysicalCountAction,
  updateCountedQtyAction,
  type ActionState,
} from "@/app/actions/physical";

const initial: ActionState = {};

export function CreateCountButton({
  departments,
  lockDepartment,
}: {
  departments: { id: string; code: string; name: string }[];
  lockDepartment?: boolean;
}) {
  const [state, action, pending] = useActionState(createPhysicalCount, initial);

  return (
    <form action={action} className="flex flex-col gap-2 sm:items-end">
      {lockDepartment ? null : (
        <select
          name="department_id"
          defaultValue=""
          className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="">Todos los departamentos</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.code} — {department.name}
            </option>
          ))}
        </select>
      )}
      <input
        name="notes"
        placeholder="Notas del conteo"
        className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
      />
      <p className="max-w-xs text-xs text-zinc-500">
        Recomendado: un conteo por departamento (EST, LEN, LAV, SUM), no los
        227 de golpe. Con sistema en 0, el cierre carga la existencia inicial.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {pending ? "Creando…" : "+ Nuevo conteo"}
      </button>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-emerald-700">{state.success}</p>
      ) : null}
    </form>
  );
}

export function PostCountButton({
  countId,
  pendingLines,
}: {
  countId: string;
  pendingLines: number;
}) {
  const [state, action, pending] = useActionState(
    postPhysicalCountAction,
    initial,
  );

  return (
    <form
      action={action}
      className="space-y-2"
      onSubmit={(event) => {
        if (pendingLines > 0) {
          const ok = window.confirm(
            `Hay ${pendingLines} línea${pendingLines === 1 ? "" : "s"} sin contar. Al cerrar no se inicializan ni se ajustan. ¿Cerrar de todos modos?`,
          );
          if (!ok) event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="count_id" value={countId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {pending ? "Cerrando…" : "Cerrar conteo (aplicar ajustes)"}
      </button>
      {pendingLines > 0 ? (
        <p className="text-xs text-amber-800">
          {pendingLines} pendiente{pendingLines === 1 ? "" : "s"}: no se
          inicializan al cerrar.
        </p>
      ) : null}
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-emerald-700">{state.success}</p>
      ) : null}
    </form>
  );
}

export function CountedQtyInput({
  lineId,
  defaultValue,
}: {
  lineId: string;
  defaultValue: number | null;
}) {
  const [state, action, pending] = useActionState(
    updateCountedQtyAction,
    initial,
  );
  const [saved, setSaved] = useState(defaultValue);

  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        const raw = String(
          new FormData(event.currentTarget).get("counted_qty") ?? "",
        ).trim();
        if (raw === "") event.preventDefault();
      }}
    >
      <input type="hidden" name="line_id" value={lineId} />
      <input
        name="counted_qty"
        type="number"
        min="0"
        step="0.001"
        defaultValue={defaultValue ?? ""}
        onBlur={(event) => {
          const raw = event.target.value.trim();
          if (raw === "") return;
          const qty = Number(raw);
          if (Number.isNaN(qty) || qty < 0) return;
          if (saved === qty) return;
          setSaved(qty);
          event.target.form?.requestSubmit();
        }}
        aria-label="Cantidad contada"
        className="min-h-10 w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
      />
      {pending ? (
        <span className="text-xs text-zinc-500">Guardando…</span>
      ) : null}
      {state.error ? (
        <span className="text-xs text-red-700">{state.error}</span>
      ) : null}
    </form>
  );
}

export type CountLineView = {
  id: string;
  system_qty: number;
  counted_qty: number | null;
  product_label: string;
  classification: {
    label: string;
    className: string;
    diff: number | null;
  };
};

export function CountLinesPanel({
  lines,
  canWrite,
  isDraft,
}: {
  lines: CountLineView[];
  canWrite: boolean;
  isDraft: boolean;
}) {
  const [q, setQ] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lines.filter((line) => {
      if (pendingOnly && line.counted_qty != null) return false;
      if (!needle) return true;
      return line.product_label.toLowerCase().includes(needle);
    });
  }, [lines, pendingOnly, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="font-medium text-zinc-700">Buscar producto</span>
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Código o nombre"
            className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
          />
        </label>
        <label className="inline-flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(event) => setPendingOnly(event.target.checked)}
          />
          Solo pendientes
        </label>
      </div>

      <ul className="space-y-3 md:hidden">
        {visible.map((line) => (
          <li
            key={line.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="font-medium">{line.product_label}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Sistema</dt>
                <dd className="tabular-nums">{line.system_qty}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Diferencia</dt>
                <dd className="tabular-nums">
                  {line.classification.diff ?? "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${line.classification.className}`}
              >
                {line.classification.label}
              </span>
            </div>
            {isDraft && canWrite ? (
              <div className="mt-3">
                <p className="mb-1 text-xs text-zinc-500">
                  Conteo físico (se guarda al salir del campo)
                </p>
                <CountedQtyInput
                  lineId={line.id}
                  defaultValue={line.counted_qty}
                />
              </div>
            ) : (
              <p className="mt-2 text-sm">
                Contado:{" "}
                <span className="tabular-nums font-medium">
                  {line.counted_qty ?? "—"}
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Sistema</th>
              <th className="px-4 py-3 font-medium">Conteo</th>
              <th className="px-4 py-3 font-medium">Diferencia</th>
              <th className="px-4 py-3 font-medium">Clasificación</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((line) => (
              <tr key={line.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">{line.product_label}</td>
                <td className="px-4 py-3 tabular-nums">{line.system_qty}</td>
                <td className="px-4 py-3">
                  {isDraft && canWrite ? (
                    <CountedQtyInput
                      lineId={line.id}
                      defaultValue={line.counted_qty}
                    />
                  ) : (
                    <span className="tabular-nums">
                      {line.counted_qty ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {line.classification.diff ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${line.classification.className}`}
                  >
                    {line.classification.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">Ninguna línea con este filtro.</p>
      ) : null}
    </div>
  );
}
