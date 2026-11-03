import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessModule, type ModuleKey } from "@/lib/auth/modules";
import type { Profile } from "@/lib/auth/roles";

const PROFILE_COLUMNS =
  "id, full_name, role, department_id, is_active, must_change_password";

export const getCurrentUserAndProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null as Profile | null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: profile as Profile | null };
});

export async function requireActiveUser() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) {
    throw new Error("No autenticado");
  }
  if (!profile?.is_active) {
    throw new Error("Usuario desactivado");
  }
  return { user, profile };
}

/** Write-path gate: same as requireActiveUser (inactive users cannot act). */
export async function requireUser() {
  return requireActiveUser();
}

export async function requireModule(module: ModuleKey) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) {
    redirect("/login");
  }
  if (!profile?.is_active) {
    redirect("/login?error=inactive");
  }
  if (profile.must_change_password) {
    redirect("/cambiar-password");
  }
  if (!canAccessModule(profile.role, module)) {
    redirect("/");
  }
  return { user, profile };
}
