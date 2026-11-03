"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError } from "@/lib/actions/errors";
import { requireActiveUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseChangePassword } from "@/lib/users/rules";

export type AuthState = {
  error?: string;
};

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa correo y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciales inválidas." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function changeOwnPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { user } = await requireActiveUser();

  const parsed = parseChangePassword({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.password });
  if (error) {
    return { error: toActionError(error, "No se pudo actualizar la contraseña.") };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    return {
      error: toActionError(profileError, "No se pudo actualizar el perfil."),
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
