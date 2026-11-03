"use client";

import { useActionState, useMemo, useState } from "react";
import {
  confirmAllocation,
  createAllocation,
  createRoomParam,
  reviseAllocation,
  upsertRoomParam,
  type ActionState,
} from "@/app/actions/maid";
import {
  previewAllocationMatrix,
  SERVICE_LABELS,
  SERVICE_TYPES,
  type ServiceType,
  type SupplyParam,
} from "@/lib/maid/preview";

const initial: ActionState = {};

type Product = { id: string; code: string; name: string };

export function RoomParamForm({
  products,
  mode = "create",
}: {
  products: Product[];
  mode?: "create" | "upsert";
}) {
  const actionFn = mode === "upsert" ? upsertRoomParam : createRoomParam;
  const [state, action, pending] = useActionState(actionFn, initial);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">
        {mode === "upsert" ? "Guardar parámetro" : "Nuevo parámetro"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select name="product_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Producto…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>
        <input name="room_type" defaultValue="standard" placeholder="Tipo habitación" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <select name="service_type" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="ocupacion">
          {SERVICE_TYPES.map((service) => (
            <option key={service} value={service}>
              {SERVICE_LABELS[service]}
            </option>
          ))}
        </select>
        <input name="qty_per_room" type="number" min="0" step="0.001" defaultValue={1} required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

function countKey(roomType: string, service: ServiceType) {
  return `count|${roomType}|${service}`;
}

export function CreateAllocationForm({
  roomTypes,
  params,
  today,
}: {
  roomTypes: string[];
  params: SupplyParam[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createAllocation, initial);
  const types = useMemo(
    () => (roomTypes.length > 0 ? roomTypes : ["standard"]),
    [roomTypes],
  );
  const [counts, setCounts] = useState<Record<string, number>>({});

  const rooms = useMemo(
    () =>
      types.flatMap((roomType) =>
        SERVICE_TYPES.map((serviceType) => ({
          roomType,
          serviceType,
          count: counts[countKey(roomType, serviceType)] ?? 0,
        })),
      ),
    [counts, types],
  );

  const preview = useMemo(
    () => previewAllocationMatrix(rooms, params),
    [rooms, params],
  );

  return (
    <form action={action} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold">Nueva dotación</h3>
      <div className="grid gap-3 sm:grid-cols-3 print:hidden">
        <input name="maid_name" required placeholder="Camarera" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="shift" placeholder="Turno" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="allocation_date" type="date" defaultValue={today} className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">Tipo de habitación</th>
              {SERVICE_TYPES.map((service) => (
                <th key={service} className="px-3 py-2 font-medium">
                  {SERVICE_LABELS[service]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((roomType) => (
              <tr key={roomType} className="border-t border-zinc-100">
                <td className="px-3 py-2 capitalize">{roomType}</td>
                {SERVICE_TYPES.map((service) => {
                  const name = countKey(roomType, service);
                  return (
                    <td key={service} className="px-3 py-2">
                      <input
                        name={name}
                        type="number"
                        min="0"
                        step="1"
                        value={counts[name] ?? 0}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setCounts((prev) => ({
                            ...prev,
                            [name]: Number.isNaN(value) ? 0 : value,
                          }));
                        }}
                        className="min-h-10 w-24 rounded-md border border-zinc-300 px-2 text-sm tabular-nums"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AllocationPreviewTables preview={preview} />

      {state.error ? <p className="text-sm text-red-700 print:hidden">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700 print:hidden">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60 print:hidden">
        {pending ? "Creando…" : "Crear borrador"}
      </button>
    </form>
  );
}

export function AllocationPreviewTables({
  preview,
}: {
  preview: ReturnType<typeof previewAllocationMatrix>;
}) {
  const groups: { title: string; lines: typeof preview.amenidades }[] = [
    { title: "Amenidades", lines: preview.amenidades },
    { title: "Lencería", lines: preview.lenceria },
  ];
  if (preview.otros.length > 0) {
    groups.push({ title: "Otros", lines: preview.otros });
  }

  const hasLines = groups.some((g) => g.lines.length > 0);

  return (
    <div className="space-y-4">
      {!hasLines ? (
        <p className="text-sm text-zinc-500">
          Indica cuántas habitaciones hay por estatus para ver el total por producto.
        </p>
      ) : null}
      {groups.map((group) =>
        group.lines.length === 0 ? null : (
          <div key={group.title}>
            <h4 className="text-sm font-semibold">{group.title}</h4>
            <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Producto</th>
                    {SERVICE_TYPES.map((service) => (
                      <th key={service} className="px-3 py-2 font-medium">
                        {SERVICE_LABELS[service]}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">Total a llevar</th>
                  </tr>
                </thead>
                <tbody>
                  {group.lines.map((line) => (
                    <tr key={line.code} className="border-t border-zinc-100">
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-zinc-500">{line.code}</span>{" "}
                        {line.name}
                      </td>
                      {SERVICE_TYPES.map((service) => (
                        <td key={service} className="px-3 py-2 tabular-nums">
                          {line.byService[service] || "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 font-medium tabular-nums">{line.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

export function ConfirmAllocationButton({ allocationId }: { allocationId: string }) {
  const [state, action, pending] = useActionState(confirmAllocation, initial);
  return (
    <form
      action={action}
      className="inline print:hidden"
      onSubmit={(event) => {
        if (!window.confirm("¿Confirmar esta dotación y registrar las salidas?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="allocation_id" value={allocationId} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-9 rounded-md bg-teal-800 px-3 text-xs font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {pending ? "…" : "Confirmar"}
      </button>
      {state.error ? <span className="ml-2 text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

export function ReviseAllocationForm({
  allocationId,
  roomTypes,
  params,
  initialCounts,
}: {
  allocationId: string;
  roomTypes: string[];
  params: SupplyParam[];
  initialCounts: { roomType: string; serviceType: string; count: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reviseAllocation, initial);
  const types = useMemo(
    () => (roomTypes.length > 0 ? roomTypes : ["standard"]),
    [roomTypes],
  );
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const next: Record<string, number> = {};
    for (const row of initialCounts) {
      if (!SERVICE_TYPES.includes(row.serviceType as ServiceType)) continue;
      next[countKey(row.roomType, row.serviceType as ServiceType)] = row.count;
    }
    return next;
  });

  const rooms = useMemo(
    () =>
      types.flatMap((roomType) =>
        SERVICE_TYPES.map((serviceType) => ({
          roomType,
          serviceType,
          count: counts[countKey(roomType, serviceType)] ?? 0,
        })),
      ),
    [counts, types],
  );

  const preview = useMemo(
    () => previewAllocationMatrix(rooms, params),
    [rooms, params],
  );

  const oldPreview = useMemo(
    () => previewAllocationMatrix(initialCounts, params),
    [initialCounts, params],
  );

  const deltas = useMemo(() => {
    const map = new Map<string, { name: string; before: number; after: number }>();
    for (const group of [oldPreview.amenidades, oldPreview.lenceria, oldPreview.otros]) {
      for (const line of group) {
        map.set(line.code, { name: line.name, before: line.qty, after: 0 });
      }
    }
    for (const group of [preview.amenidades, preview.lenceria, preview.otros]) {
      for (const line of group) {
        const prev = map.get(line.code) ?? { name: line.name, before: 0, after: 0 };
        prev.after = line.qty;
        prev.name = line.name;
        map.set(line.code, prev);
      }
    }
    return Array.from(map.entries())
      .map(([code, row]) => ({ code, ...row, delta: row.after - row.before }))
      .filter((row) => row.delta !== 0);
  }, [oldPreview, preview]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs hover:bg-zinc-50 print:hidden"
      >
        Rectificar
      </button>
    );
  }

  return (
    <form
      action={action}
      className="mt-3 w-full space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 print:hidden"
      onSubmit={(event) => {
        if (!window.confirm("¿Rectificar esta dotación y ajustar el kardex?")) {
          event.preventDefault();
        }
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Rectificar conteos</h4>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-600 hover:text-zinc-900"
        >
          Cancelar
        </button>
      </div>
      <input type="hidden" name="allocation_id" value={allocationId} />
      <div className="overflow-x-auto rounded-md bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">Tipo de habitación</th>
              {SERVICE_TYPES.map((service) => (
                <th key={service} className="px-3 py-2 font-medium">
                  {SERVICE_LABELS[service]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((roomType) => (
              <tr key={roomType} className="border-t border-zinc-100">
                <td className="px-3 py-2 capitalize">{roomType}</td>
                {SERVICE_TYPES.map((service) => {
                  const name = countKey(roomType, service);
                  return (
                    <td key={service} className="px-3 py-2">
                      <input
                        name={name}
                        type="number"
                        min="0"
                        step="1"
                        value={counts[name] ?? 0}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setCounts((prev) => ({
                            ...prev,
                            [name]: Number.isNaN(value) ? 0 : value,
                          }));
                        }}
                        className="min-h-10 w-24 rounded-md border border-zinc-300 px-2 text-sm tabular-nums"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AllocationPreviewTables preview={preview} />
      {deltas.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold">Ajuste al kardex</h4>
          <ul className="mt-1 space-y-0.5 text-xs text-zinc-700">
            {deltas.map((row) => (
              <li key={row.code}>
                <span className="font-mono">{row.code}</span> {row.name}:{" "}
                {row.delta > 0 ? `salida +${row.delta}` : `entrada +${Math.abs(row.delta)}`}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-zinc-600">Sin cambio de cantidades respecto a lo ya entregado.</p>
      )}
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {pending ? "Rectificando…" : "Guardar rectificación"}
      </button>
    </form>
  );
}
