import { canAccessModule, type ModuleKey } from "@/lib/auth/modules";
import { getCurrentUserAndProfile } from "@/lib/auth/session";
import type { Profile } from "@/lib/auth/roles";
import type { User } from "@supabase/supabase-js";

const FORBIDDEN: Record<ModuleKey, string> = {
  dashboard: "No tienes permiso para ver el panel.",
  inventario: "No tienes permiso para ver el inventario.",
  movimientos: "No tienes permiso para registrar movimientos.",
  alertas: "No tienes permiso para ver las alertas.",
  categorias: "No tienes permiso para gestionar el catálogo.",
  blancos: "No tienes permiso para mover blancos.",
  dotacion: "No tienes permiso para gestionar dotaciones.",
  inventario_fisico: "No tienes permiso para gestionar conteos.",
  uniformes: "No tienes permiso para gestionar uniformes.",
  maquinaria: "No tienes permiso para gestionar maquinaria.",
  reportes: "No tienes permiso para ver reportes.",
  estadisticas: "No tienes permiso para gestionar ocupación.",
  departamentos: "No tienes permiso para gestionar departamentos.",
  usuarios: "No tienes permiso para gestionar usuarios.",
  linner_recepcion: "No tienes permiso para el linner de recepción.",
};

export type ModuleActionOk = {
  ok: true;
  error?: undefined;
  user: User;
  profile: Profile;
};

export type ModuleActionErr = {
  ok: false;
  error: string;
};

export type ModuleActionGate = ModuleActionOk | ModuleActionErr;

export async function requireModuleAction(
  module: ModuleKey,
): Promise<ModuleActionGate> {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) return { ok: false, error: "No autenticado." };
  if (!profile?.is_active) return { ok: false, error: "Usuario desactivado." };
  if (!canAccessModule(profile.role, module)) {
    return { ok: false, error: FORBIDDEN[module] };
  }
  return { ok: true, user, profile };
}
