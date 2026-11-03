import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format/datetime";

const STATUS_LABEL: Record<string, string> = {
  reportada: "Reportada",
  entregada: "Entregada",
  en_reparacion: "En reparación",
  reparada: "Reparada",
  fuera_de_servicio: "Fuera de servicio",
};

const KIND_LABEL: Record<string, string> = {
  laundry_machine: "Máquina",
  room_equipment: "Equipo",
};

const OPEN = new Set(["reportada", "entregada", "en_reparacion"]);

export async function MaquinariaReport() {
  const supabase = await createClient();
  const [{ data: machines }, { data: tickets }] = await Promise.all([
    supabase.from("machines").select("id, code, name, kind, is_active").order("code"),
    supabase
      .from("machine_tickets")
      .select("id, machine_id, status, problem_description, reported_at")
      .order("reported_at", { ascending: false }),
  ]);

  const openByMachine = new Map<
    string,
    { id: string; machine_id: string; status: string; problem_description: string; reported_at: string }
  >();
  for (const ticket of tickets ?? []) {
    if (!OPEN.has(ticket.status)) continue;
    if (!openByMachine.has(ticket.machine_id)) {
      openByMachine.set(ticket.machine_id, ticket);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">Estatus de maquinaria y equipos</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Ticket abierto</th>
            </tr>
          </thead>
          <tbody>
            {(machines ?? []).map((m) => {
              const ticket = openByMachine.get(m.id);
              return (
                <tr key={m.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{KIND_LABEL[m.kind] ?? m.kind}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.code}</td>
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3">
                    {!m.is_active
                      ? "Inactiva"
                      : ticket
                        ? STATUS_LABEL[ticket.status] ?? ticket.status
                        : "Operativa"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {ticket
                      ? `${ticket.problem_description} · ${formatDateTime(ticket.reported_at)}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
