"use client";

import { useActionState, useState } from "react";
import {
  adjustUniformSku,
  assignUniform,
  createUniformSku,
  createUniformWorker,
  markUniformUnusable,
  returnUniform,
  setUniformWorkerActive,
  setUniformWorkerEmployment,
  type ActionState,
} from "@/app/actions/uniforms";
import {
  formatWorkerOptionLabel,
  resolveWorkerId,
} from "@/lib/uniforms/workers";

const initial: ActionState = {};

type Dept = { id: string; code: string; name: string };
type Sku = { id: string; code: string; name: string; size: string; available: number };
type Assignment = {
  id: string;
  sku_id?: string;
  worker_name: string;
  quantity: number;
  uniform_skus: { code: string; name: string; size: string } | null;
};
type WorkerOption = {
  id: string;
  uniform_code: string;
  last_name: string;
  first_name: string;
  staff_department: string;
};

export function CreateUniformForm({ departments }: { departments: Dept[] }) {
  const [state, action, pending] = useActionState(createUniformSku, initial);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold">Registrar uniforme</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input name="code" required placeholder="Código" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="name" required placeholder="Nombre" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="size" required placeholder="Talla" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <select name="department_id" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="">Sin departamento</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
          ))}
        </select>
        <input name="total" type="number" min="0" step="1" defaultValue={1} required placeholder="Total" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Guardando…" : "Crear"}
      </button>
    </form>
  );
}

export function AssignUniformForm({
  skus,
  workers,
}: {
  skus: Sku[];
  workers: WorkerOption[];
}) {
  const [state, action, pending] = useActionState(assignUniform, initial);
  const [workerQuery, setWorkerQuery] = useState("");
  const available = skus.filter((s) => s.available > 0);
  const workerId = resolveWorkerId(workers, "", workerQuery);
  const listId = "uniform-worker-options";

  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold">Asignar uniforme</h3>
      <p className="text-xs text-zinc-500">
        Elija al trabajador del padrón (código o nombre). Primero registre la prenda si aún no existe.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select name="sku_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Prenda…</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} {s.size} (disp. {s.available})
            </option>
          ))}
        </select>
        <div>
          <input type="hidden" name="worker_id" value={workerId} />
          <input
            name="worker_query"
            list={listId}
            required
            value={workerQuery}
            onChange={(event) => setWorkerQuery(event.target.value)}
            placeholder="Trabajador (código o nombre)"
            className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm"
            autoComplete="off"
          />
          <datalist id={listId}>
            {workers.map((worker) => (
              <option key={worker.id} value={formatWorkerOptionLabel(worker)} />
            ))}
          </datalist>
        </div>
        <input name="quantity" type="number" min="1" step="1" defaultValue={1} required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="notes" placeholder="Notas" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending || available.length === 0 || !workerId}
        className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {pending ? "Asignando…" : "Asignar"}
      </button>
    </form>
  );
}

export function CreateUniformWorkerForm({
  staffDepartments,
}: {
  staffDepartments: string[];
}) {
  const [state, action, pending] = useActionState(createUniformWorker, initial);
  const listId = "staff-department-options";
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold">Dar de alta un trabajador</h3>
      <p className="text-xs text-zinc-500">
        Use el código de uniforme del hotel. El departamento es el del personal, no el del inventario.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input name="uniform_code" required placeholder="Código" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="last_name" required placeholder="Apellidos" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="first_name" required placeholder="Nombres" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <div>
          <input
            name="staff_department"
            list={listId}
            required
            placeholder="Departamento del hotel"
            className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm"
          />
          <datalist id={listId}>
            {staffDepartments.map((dept) => (
              <option key={dept} value={dept} />
            ))}
          </datalist>
        </div>
        <input name="position" required placeholder="Cargo" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <select name="employment_type" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="fijo">
          <option value="fijo">Fijo</option>
          <option value="eventual">Eventual</option>
        </select>
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Guardando…" : "Dar de alta"}
      </button>
    </form>
  );
}

export function ToggleWorkerActiveButton({
  workerId,
  isActive,
}: {
  workerId: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(setUniformWorkerActive, initial);
  return (
    <form
      action={action}
      className="inline"
      onSubmit={(event) => {
        if (
          isActive &&
          !window.confirm("¿Dar de baja a este trabajador del padrón de uniformes?")
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="worker_id" value={workerId} />
      <input type="hidden" name="is_active" value={isActive ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "…" : isActive ? "Dar de baja" : "Activar"}
      </button>
      {state.error ? <span className="ml-2 text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

export function ReturnUniformButton({ assignment }: { assignment: Assignment }) {
  const [state, action, pending] = useActionState(returnUniform, initial);
  const sku = assignment.uniform_skus;
  return (
    <form
      action={action}
      className="inline"
      onSubmit={(event) => {
        if (!window.confirm("¿Registrar la devolución de este uniforme?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="assignment_id" value={assignment.id} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs hover:bg-zinc-50 disabled:opacity-60"
        title={sku ? `${sku.code} — ${assignment.worker_name}` : undefined}
      >
        {pending ? "…" : "Devolver"}
      </button>
      {state.error ? <span className="ml-2 text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

export function SetWorkerEmploymentForm({
  workerId,
  employmentType,
}: {
  workerId: string;
  employmentType: string;
}) {
  const [state, action, pending] = useActionState(setUniformWorkerEmployment, initial);
  return (
    <form action={action} className="inline-flex items-center gap-1">
      <input type="hidden" name="worker_id" value={workerId} />
      <select
        name="employment_type"
        defaultValue={employmentType === "eventual" ? "eventual" : "fijo"}
        className="min-h-9 rounded-md border border-zinc-300 bg-white px-2 text-xs"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="fijo">Fijo</option>
        <option value="eventual">Eventual</option>
      </select>
      <button type="submit" disabled={pending} className="sr-only">
        Guardar
      </button>
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

export function MarkAssignmentUnusableButton({ assignment }: { assignment: Assignment }) {
  const [state, action, pending] = useActionState(markUniformUnusable, initial);
  if (!assignment.sku_id) return null;
  return (
    <form
      action={action}
      className="inline"
      onSubmit={(event) => {
        if (!window.confirm("¿Pasar esta prenda asignada a no utilizable?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="sku_id" value={assignment.sku_id} />
      <input type="hidden" name="assignment_id" value={assignment.id} />
      <input type="hidden" name="from" value="in_use" />
      <input type="hidden" name="quantity" value={assignment.quantity} />
      <input type="hidden" name="reason" value="No utilizable desde asignación" />
      <button
        type="submit"
        disabled={pending}
        className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "…" : "No utilizable"}
      </button>
      {state.error ? <span className="ml-2 text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

export function MarkUnusableForm({ skus }: { skus: Sku[] }) {
  const [state, action, pending] = useActionState(markUniformUnusable, initial);
  const available = skus.filter((s) => s.available > 0);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold">Marcar no utilizable (RR.HH.)</h3>
      <p className="text-xs text-zinc-500">
        Pasa prendas del almacén de RR.HH. a no utilizables. El total no cambia.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="sku_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Prenda…</option>
          {available.map((sku) => (
            <option key={sku.id} value={sku.id}>
              {sku.code} {sku.size} (disp. {sku.available})
            </option>
          ))}
        </select>
        <input name="quantity" type="number" min="1" step="1" defaultValue={1} required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="reason" required placeholder="Motivo" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      <input type="hidden" name="from" value="available" />
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button type="submit" disabled={pending || available.length === 0} className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm hover:bg-zinc-50 disabled:opacity-60">
        {pending ? "Guardando…" : "Marcar no utilizable"}
      </button>
    </form>
  );
}

export function AdjustUniformForm({ skus }: { skus: Sku[] }) {
  const [state, action, pending] = useActionState(adjustUniformSku, initial);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold">Ajustar existencia</h3>
      <p className="text-xs text-zinc-500">
        Suma o resta unidades del almacén de RR.HH. El total = RR.HH. + en uso + no utilizable.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="sku_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Prenda…</option>
          {skus.map((sku) => (
            <option key={sku.id} value={sku.id}>
              {sku.code} {sku.size}
            </option>
          ))}
        </select>
        <input name="delta_total" type="number" step="1" required placeholder="+/− unidades" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input name="reason" required placeholder="Motivo" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm hover:bg-zinc-50 disabled:opacity-60">
        {pending ? "Guardando…" : "Registrar ajuste"}
      </button>
    </form>
  );
}
