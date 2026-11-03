"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import {
  parseIsoDate,
  parseNonNegativeNumber,
  parseOptionalText,
  parsePositiveNumber,
} from "@/lib/actions/parse";
import { createClient } from "@/lib/supabase/server";
import { dailyOccupancyPct } from "@/lib/stats/occupancy";

export type ActionState = {
  error?: string;
  success?: string;
};

function revalidateStats() {
  revalidatePath("/estadisticas");
  revalidatePath("/");
}

export async function updateHotelRooms(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("estadisticas");
  if (!gate.ok) return { error: gate.error };

  const parsedRooms = parsePositiveNumber(
    formData.get("total_rooms"),
    "El total de habitaciones",
  );
  if (!parsedRooms.ok) return { error: parsedRooms.error };
  const totalRooms = Math.floor(parsedRooms.value);
  if (totalRooms !== parsedRooms.value) {
    return { error: "El total de habitaciones debe ser un entero mayor a 0." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("hotel_settings").upsert(
    {
      id: 1,
      total_rooms: totalRooms,
      updated_by: gate.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    return { error: toActionError(error, "No se pudo guardar el total de habitaciones.") };
  }

  revalidateStats();
  return { success: "Total de habitaciones actualizado." };
}

export async function upsertDailyOccupancy(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("estadisticas");
  if (!gate.ok) return { error: gate.error };

  const occupancyDate = parseIsoDate(formData.get("occupancy_date"));
  const occupiedDirty = parseNonNegativeNumber(
    formData.get("occupied_dirty"),
    "Las habitaciones dirty",
  );
  const occupiedClean = parseNonNegativeNumber(
    formData.get("occupied_clean"),
    "Las habitaciones clean",
  );
  const notes = parseOptionalText(formData.get("notes"), "Notas");
  if (!occupancyDate.ok) return { error: occupancyDate.error };
  if (!occupiedDirty.ok) return { error: occupiedDirty.error };
  if (!occupiedClean.ok) return { error: occupiedClean.error };
  if (!notes.ok) return { error: notes.error };
  if (
    !Number.isInteger(occupiedDirty.value) ||
    !Number.isInteger(occupiedClean.value)
  ) {
    return { error: "Las habitaciones ocupadas deben ser enteros ≥ 0." };
  }

  const supabase = await createClient();
  const { data: settings, error: settingsError } = await supabase
    .from("hotel_settings")
    .select("total_rooms")
    .eq("id", 1)
    .maybeSingle();

  if (settingsError) {
    return {
      error: toActionError(
        settingsError,
        "No se pudo leer la configuración del hotel.",
      ),
    };
  }

  const totalRooms = Number(settings?.total_rooms ?? 0);
  if (totalRooms <= 0) {
    return { error: "Configura primero el total de habitaciones del hotel." };
  }
  if (occupiedDirty.value + occupiedClean.value > totalRooms) {
    return {
      error: `Dirty + clean (${occupiedDirty.value + occupiedClean.value}) supera el total (${totalRooms}).`,
    };
  }

  const occupancyPct = dailyOccupancyPct(
    occupiedDirty.value,
    occupiedClean.value,
    totalRooms,
  );

  const { error } = await supabase.from("daily_occupancy").upsert(
    {
      occupancy_date: occupancyDate.value,
      occupied_dirty: occupiedDirty.value,
      occupied_clean: occupiedClean.value,
      total_rooms: totalRooms,
      notes: notes.value,
      updated_by: gate.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "occupancy_date" },
  );

  if (error) {
    return { error: toActionError(error, "No se pudo guardar la ocupación.") };
  }

  revalidateStats();
  return { success: `Ocupación guardada (${occupancyPct}%).` };
}
