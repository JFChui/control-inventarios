"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import { parseOptionalText, parseRequiredText } from "@/lib/actions/parse";
import { createClient } from "@/lib/supabase/server";
import { nextMachineStatuses } from "@/lib/machines/transitions";

export type ActionState = {
  error?: string;
  success?: string;
};

export async function createMachine(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("maquinaria");
  if (!gate.ok) return { error: gate.error };

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const name = parseRequiredText(formData.get("name"), "Nombre");
  const kindRaw = String(formData.get("kind") ?? "laundry_machine");
  const kind =
    kindRaw === "room_equipment" ? "room_equipment" : "laundry_machine";

  if (!code || !name.ok) {
    return { error: name.ok ? "Código y nombre son obligatorios." : name.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("machines").insert({
    code,
    name: name.value,
    kind,
    is_active: true,
  });

  if (error) {
    return { error: toActionError(error, "No se pudo registrar la máquina.") };
  }

  revalidatePath("/maquinaria");
  return {
    success: kind === "room_equipment" ? "Equipo registrado." : "Máquina registrada.",
  };
}

const STATUSES = new Set([
  "reportada",
  "entregada",
  "en_reparacion",
  "reparada",
  "fuera_de_servicio",
]);

export async function createTicket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("maquinaria");
  if (!gate.ok) return { error: gate.error };

  const machineId = String(formData.get("machine_id") ?? "");
  const problemDescription = parseRequiredText(
    formData.get("problem_description"),
    "Descripción",
    1000,
  );
  const maintenanceAssignee = parseOptionalText(
    formData.get("maintenance_assignee"),
    "Asignado",
  );

  if (!machineId || !problemDescription.ok) {
    return {
      error: problemDescription.ok
        ? "Máquina y descripción son obligatorias."
        : problemDescription.error,
    };
  }
  if (!maintenanceAssignee.ok) return { error: maintenanceAssignee.error };

  const supabase = await createClient();
  const { error } = await supabase.from("machine_tickets").insert({
    machine_id: machineId,
    problem_description: problemDescription.value,
    maintenance_assignee: maintenanceAssignee.value,
    reported_by: gate.user.id,
    status: "reportada",
  });

  if (error) {
    return { error: toActionError(error, "No se pudo reportar la falla.") };
  }

  revalidatePath("/maquinaria");
  revalidatePath("/");
  return { success: "Ticket de falla reportado." };
}

export async function updateTicketStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("maquinaria");
  if (!gate.ok) return { error: gate.error };

  const ticketId = String(formData.get("ticket_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!ticketId || !STATUSES.has(status)) {
    return { error: "Ticket y estado válidos son obligatorios." };
  }

  const supabase = await createClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("machine_tickets")
    .select("status")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError || !ticket) {
    return { error: toActionError(ticketError, "Ticket no encontrado.") };
  }
  if (!nextMachineStatuses(ticket.status).includes(status)) {
    return { error: "Esa transición de ticket no está permitida." };
  }

  const { error } = await supabase
    .from("machine_tickets")
    .update({ status })
    .eq("id", ticketId);

  if (error) {
    return { error: toActionError(error, "No se pudo actualizar el ticket.") };
  }

  revalidatePath("/maquinaria");
  revalidatePath("/");
  return { success: "Estado actualizado." };
}
