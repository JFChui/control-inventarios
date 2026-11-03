export const MACHINE_TICKET_NEXT: Record<string, string[]> = {
  reportada: ["entregada"],
  entregada: ["en_reparacion"],
  en_reparacion: ["reparada", "fuera_de_servicio"],
  reparada: [],
  fuera_de_servicio: [],
};

export function nextMachineStatuses(status: string) {
  return MACHINE_TICKET_NEXT[status] ?? [];
}
