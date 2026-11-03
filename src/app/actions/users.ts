"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAction } from "@/lib/actions/guard";
import { toActionError } from "@/lib/actions/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  assertNotSelfLockout,
  canResetUserPassword,
  generateTempPassword,
  isEmailTakenError,
  parseCreateUser,
  parseProfileUpdate,
  USER_EMAIL_TAKEN,
  USER_SELF_RESET,
} from "@/lib/users/rules";
import { finalizeUserProvisioning } from "@/lib/users/provision";

export type ActionState = {
  error?: string;
  success?: string;
  tempPassword?: string;
};

function revalidateUsers() {
  revalidatePath("/usuarios");
}

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("usuarios");
  if (!gate.ok) return { error: gate.error };

  const parsed = parseCreateUser({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("full_name") ?? ""),
    role: String(formData.get("role") ?? ""),
    departmentId: String(formData.get("department_id") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: parsed.fullName },
  });

  if (error) {
    if (isEmailTakenError(error.message)) {
      return { error: USER_EMAIL_TAKEN };
    }
    return { error: toActionError(error, "No se pudo crear el usuario.") };
  }
  if (!data.user) {
    return { error: "No se pudo crear el usuario." };
  }

  const finalization = await finalizeUserProvisioning({
    userId: data.user.id,
    finalizeProfile: async () => {
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          full_name: parsed.fullName,
          role: parsed.role,
          department_id: parsed.departmentId,
          must_change_password: true,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.user.id)
        .select("id")
        .single();
      return { error: profileError };
    },
    deleteUser: async (userId) => {
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      return { error: deleteError };
    },
  });

  if (finalization.error) return { error: finalization.error };

  revalidateUsers();
  return { success: "Usuario creado.", tempPassword };
}

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("usuarios");
  if (!gate.ok) return { error: gate.error };

  const parsed = parseProfileUpdate({
    id: String(formData.get("id") ?? ""),
    fullName: String(formData.get("full_name") ?? ""),
    role: String(formData.get("role") ?? ""),
    departmentId: String(formData.get("department_id") ?? ""),
    isActive: formData.get("is_active") as string | null,
  });
  if (!parsed.ok) return { error: parsed.error };

  const lockout = assertNotSelfLockout({
    actorId: gate.user.id,
    targetId: parsed.id,
    nextRole: parsed.role,
    nextIsActive: parsed.isActive,
  });
  if (!lockout.ok) return { error: lockout.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.fullName,
      role: parsed.role,
      department_id: parsed.departmentId,
      is_active: parsed.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.id);

  if (error) return { error: toActionError(error, "No se pudo actualizar el perfil.") };

  revalidateUsers();
  return { success: "Perfil actualizado." };
}

export async function resetUserPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireModuleAction("usuarios");
  if (!gate.ok) return { error: gate.error };

  const targetId = String(formData.get("id") ?? "").trim();
  if (!targetId) return { error: "Usuario requerido." };
  if (!canResetUserPassword(gate.user.id, targetId)) {
    return { error: USER_SELF_RESET };
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(targetId, {
    password: tempPassword,
  });
  if (error) {
    return { error: toActionError(error, "No se pudo restablecer la contraseña.") };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      must_change_password: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetId);

  if (profileError) {
    return {
      error: toActionError(
        profileError,
        "La clave se cambió, pero no se pudo marcar el cambio obligatorio.",
      ),
    };
  }

  revalidateUsers();
  return {
    success: "Contraseña restablecida. Cópiala ahora; no se volverá a mostrar.",
    tempPassword,
  };
}
