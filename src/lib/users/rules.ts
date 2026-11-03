import { isAssignableRole } from "@/lib/auth/modules";
import { canManageUsers, type AppRole } from "@/lib/auth/roles";

export const USER_SELF_DEACTIVATE =
  "No puedes desactivar tu propia cuenta.";
export const USER_SELF_DEMOTE =
  "No puedes quitarte el cargo de gerente.";
export const USER_SELF_RESET =
  "No puedes restablecer la contraseña de tu propia cuenta.";

export const USER_FIELDS_REQUIRED = "Correo, nombre y rol son requeridos.";
export const USER_EMAIL_INVALID = "Correo inválido.";
export const USER_ROLE_INVALID = "Rol inválido.";
export const USER_ID_REQUIRED = "Usuario requerido.";
export const USER_EMAIL_TAKEN = "Ya existe un usuario con ese correo.";
export const PASSWORD_TOO_SHORT =
  "La contraseña debe tener al menos 8 caracteres.";
export const PASSWORD_MISMATCH = "Las contraseñas no coinciden.";
export const TEMP_PASSWORD_SUFFIX = "Aa1!";

export function isAppRole(value: string): value is AppRole {
  return isAssignableRole(value);
}

export function generateTempPassword(
  randomId = crypto.randomUUID(),
): string {
  return randomId.slice(0, 12) + TEMP_PASSWORD_SUFFIX;
}

function normalizeDepartmentId(raw: string): string | null {
  const departmentId = raw.trim();
  return departmentId || null;
}

function parseIsActive(value: string | boolean | null | undefined): boolean {
  if (value === true) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "on" || normalized === "true" || normalized === "1";
  }
  return false;
}

export function parseCreateUser(input: {
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
  departmentId?: string | null;
}):
  | { ok: false; error: string }
  | {
      ok: true;
      email: string;
      fullName: string;
      role: AppRole;
      departmentId: string | null;
    } {
  const email = String(input.email ?? "").trim().toLowerCase();
  const fullName = String(input.fullName ?? "").trim();
  const role = String(input.role ?? "");
  const departmentId = normalizeDepartmentId(String(input.departmentId ?? ""));

  if (!email || !fullName || !role) {
    return { ok: false, error: USER_FIELDS_REQUIRED };
  }
  if (!email.includes("@")) {
    return { ok: false, error: USER_EMAIL_INVALID };
  }
  if (!isAppRole(role)) {
    return { ok: false, error: USER_ROLE_INVALID };
  }

  return { ok: true, email, fullName, role, departmentId };
}

export function parseProfileUpdate(input: {
  id?: string | null;
  fullName?: string | null;
  role?: string | null;
  departmentId?: string | null;
  isActive?: string | boolean | null;
}):
  | { ok: false; error: string }
  | {
      ok: true;
      id: string;
      fullName: string | null;
      role: AppRole;
      departmentId: string | null;
      isActive: boolean;
    } {
  const id = String(input.id ?? "").trim();
  const fullName = String(input.fullName ?? "").trim() || null;
  const role = String(input.role ?? "");
  const departmentId = normalizeDepartmentId(String(input.departmentId ?? ""));

  if (!id) {
    return { ok: false, error: USER_ID_REQUIRED };
  }
  if (!isAppRole(role)) {
    return { ok: false, error: USER_ROLE_INVALID };
  }

  return {
    ok: true,
    id,
    fullName,
    role,
    departmentId,
    isActive: parseIsActive(input.isActive),
  };
}

export function parseChangePassword(input: {
  password?: string | null;
  confirm?: string | null;
}): { ok: false; error: string } | { ok: true; password: string } {
  const password = String(input.password ?? "");
  const confirm = String(input.confirm ?? "");

  if (password.length < 8) {
    return { ok: false, error: PASSWORD_TOO_SHORT };
  }
  if (password !== confirm) {
    return { ok: false, error: PASSWORD_MISMATCH };
  }

  return { ok: true, password };
}

export function isEmailTakenError(message: string): boolean {
  return message.toLowerCase().includes("already");
}

export function assertNotSelfLockout(input: {
  actorId: string;
  targetId: string;
  nextRole: AppRole;
  nextIsActive: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.actorId !== input.targetId) return { ok: true };
  if (!input.nextIsActive) {
    return { ok: false, error: USER_SELF_DEACTIVATE };
  }
  if (!canManageUsers(input.nextRole)) {
    return { ok: false, error: USER_SELF_DEMOTE };
  }
  return { ok: true };
}

export function canResetUserPassword(actorId: string, targetId: string) {
  return Boolean(actorId) && Boolean(targetId) && actorId !== targetId;
}
