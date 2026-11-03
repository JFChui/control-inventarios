import Link from "next/link";
import {
  CreateMachineForm,
  CreateTicketForm,
  TicketStatusButtons,
} from "@/components/machines/machine-forms";
import { PageHeader } from "@/components/ui/page-header";
import { canManageMachines, canWriteMachineTickets } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format/datetime";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  reportada: "Reportada",
  entregada: "Entregada",
  en_reparacion: "En reparación",
  reparada: "Reparada",
  fuera_de_servicio: "Fuera de servicio",
};

type Tipo = "maquinas" | "equipos";

export default async function MaquinariaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { profile } = await requireModule("maquinaria");
  const supabase = await createClient();
  const canWrite = canWriteMachineTickets(profile?.role);
  const canManage = canManageMachines(profile?.role);
  const sp = await searchParams;
  const tipo: Tipo = sp.tipo === "equipos" ? "equipos" : "maquinas";
  const kind = tipo === "equipos" ? "room_equipment" : "laundry_machine";

  const [{ data: machines }, { data: tickets }, { data: events }] =
    await Promise.all([
    supabase
      .from("machines")
      .select("id, code, name, is_active, kind")
      .eq("kind", kind)
      .order("code"),
    supabase
      .from("machine_tickets")
      .select(
        "id, status, problem_description, maintenance_assignee, reported_at, machines(code, name, kind)",
      )
      .order("reported_at", { ascending: false })
      .limit(80),
    supabase
      .from("machine_ticket_events")
      .select("id, ticket_id, from_status, to_status, created_at")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const visibleTickets = (tickets ?? []).filter((t) => {
    const machine = Array.isArray(t.machines) ? t.machines[0] : t.machines;
    return (machine?.kind ?? "laundry_machine") === kind;
  });

  const tabs: { id: Tipo; label: string }[] = [
    { id: "maquinas", label: "Máquinas" },
    { id: "equipos", label: "Equipos" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Maquinaria y equipos"
        description="Máquinas de lavandería y equipos de habitación (aspiradoras, sopladores). Reportes de falla y ciclo de mantenimiento."
      />

      <div className="flex flex-wrap gap-2 print:hidden">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/maquinaria?tipo=${tab.id}`}
            className={`inline-flex min-h-10 items-center rounded-md px-3 text-sm ${
              tipo === tab.id
                ? "bg-teal-800 font-medium text-white"
                : "border border-zinc-300 bg-white hover:bg-zinc-50"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {canManage ? <CreateMachineForm kind={kind} /> : null}

      {canWrite ? (
        <CreateTicketForm
          machines={(machines ?? [])
            .filter((m) => m.is_active)
            .map((m) => ({ id: m.id, code: m.code, name: m.name }))}
        />
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">
          {tipo === "equipos" ? "Equipos de habitación" : "Máquinas"}
        </h2>
        {(machines ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            {tipo === "equipos"
              ? "Todavía no hay equipos de habitación registrados."
              : "Todavía no hay máquinas registradas."}
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(machines ?? []).map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <p className="font-medium">{m.name}</p>
                <p className="font-mono text-xs text-zinc-500">{m.code}</p>
                {!m.is_active ? (
                  <p className="mt-1 text-sm text-zinc-600">Inactiva</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Tickets</h2>
        {visibleTickets.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Sin tickets en esta vista.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {visibleTickets.map((t) => {
              const machine = Array.isArray(t.machines)
                ? t.machines[0]
                : t.machines;
              return (
                <li
                  key={t.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {machine
                          ? `${machine.code} — ${machine.name}`
                          : tipo === "equipos"
                            ? "Equipo"
                            : "Máquina"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        {t.problem_description}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Historial:{" "}
                        {(events ?? [])
                          .filter((event) => event.ticket_id === t.id)
                          .map((event) => STATUS_LABEL[event.to_status] ?? event.to_status)
                          .reverse()
                          .join(" → ") || (STATUS_LABEL[t.status] ?? t.status)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {STATUS_LABEL[t.status] ?? t.status}
                        {t.maintenance_assignee
                          ? ` · ${t.maintenance_assignee}`
                          : ""}{" "}
                        ·{" "}
                        {formatDateTime(t.reported_at)}
                      </p>
                    </div>
                    {canWrite ? (
                      <TicketStatusButtons ticketId={t.id} status={t.status} />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
