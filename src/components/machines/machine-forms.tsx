"use client";

import { useActionState } from "react";
import {
  createMachine,
  createTicket,
  updateTicketStatus,
  type ActionState,
} from "@/app/actions/machines";
import { nextMachineStatuses } from "@/lib/machines/transitions";

const initial: ActionState = {};

type Machine = { id: string; code: string; name: string };

const STATUS_LABEL: Record<string, string> = {
  reportada: "Reportada",
  entregada: "Entregada",
  en_reparacion: "En reparación",
  reparada: "Reparada",
  fuera_de_servicio: "Fuera de servicio",
};

export function CreateMachineForm({
  kind = "laundry_machine",
}: {
  kind?: "laundry_machine" | "room_equipment";
}) {
  const [state, action, pending] = useActionState(createMachine, initial);
  const isEquipment = kind === "room_equipment";
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">
        {isEquipment ? "Registrar equipo" : "Registrar máquina"}
      </h3>
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="code" required placeholder="Código" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
        <input
          name="name"
          required
          placeholder={isEquipment ? "Nombre (aspiradora, soplador…)" : "Nombre"}
          className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm"
        />
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Guardando…" : isEquipment ? "Crear equipo" : "Crear máquina"}
      </button>
    </form>
  );
}

export function CreateTicketForm({ machines }: { machines: Machine[] }) {
  const [state, action, pending] = useActionState(createTicket, initial);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="font-semibold">Reportar falla</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="machine_id" required className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" defaultValue="">
          <option value="" disabled>Máquina o equipo…</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
          ))}
        </select>
        <input name="maintenance_assignee" placeholder="Entregar a / mantenimiento" className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm" />
      </div>
      <textarea name="problem_description" required rows={3} placeholder="Descripción del problema" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Enviando…" : "Reportar"}
      </button>
    </form>
  );
}

export function TicketStatusButtons({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(updateTicketStatus, initial);
  const next = nextMachineStatuses(status);
  if (next.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {next.map((s) => (
        <form key={s} action={action}>
          <input type="hidden" name="ticket_id" value={ticketId} />
          <input type="hidden" name="status" value={s} />
          <button
            type="submit"
            disabled={pending}
            className="min-h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs hover:bg-zinc-50 disabled:opacity-60"
          >
            → {STATUS_LABEL[s] ?? s}
          </button>
        </form>
      ))}
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </div>
  );
}
