import { canAccessModule } from "@/lib/auth/modules";

export type { AppRole } from "@/lib/auth/modules";
import type { AppRole } from "@/lib/auth/modules";

export type Profile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  department_id: string | null;
  is_active: boolean;
  must_change_password: boolean;
};

export function canManageCatalog(role: AppRole | null | undefined) {
  return canAccessModule(role, "categorias");
}

export function canWriteMovements(role: AppRole | null | undefined) {
  return canAccessModule(role, "movimientos");
}

export function canManageDepartments(role: AppRole | null | undefined) {
  return canAccessModule(role, "departamentos");
}

export function canManagePhysicalCount(role: AppRole | null | undefined) {
  return canAccessModule(role, "inventario_fisico");
}

export function canWritePhysicalCount(role: AppRole | null | undefined) {
  return canAccessModule(role, "inventario_fisico");
}

export function canManageLinen(role: AppRole | null | undefined) {
  return canAccessModule(role, "blancos");
}

export function canWriteLinen(role: AppRole | null | undefined) {
  return canAccessModule(role, "blancos");
}

export function canManageUniforms(role: AppRole | null | undefined) {
  return canAccessModule(role, "uniformes");
}

export function canAssignUniforms(role: AppRole | null | undefined) {
  return canAccessModule(role, "uniformes");
}

export function canManageRoomParams(role: AppRole | null | undefined) {
  return canManageCatalog(role);
}

export function canConfirmAllocation(role: AppRole | null | undefined) {
  return canAccessModule(role, "dotacion");
}

export function canWriteAllocation(role: AppRole | null | undefined) {
  return canAccessModule(role, "dotacion");
}

export function canManageMachines(role: AppRole | null | undefined) {
  return canAccessModule(role, "maquinaria");
}

export function canWriteMachineTickets(role: AppRole | null | undefined) {
  return canAccessModule(role, "maquinaria");
}

export function canManageOccupancy(role: AppRole | null | undefined) {
  return canAccessModule(role, "estadisticas");
}

export function canManageUsers(role: AppRole | null | undefined) {
  return canAccessModule(role, "usuarios");
}

export function canManageReceptionLimits(role: AppRole | null | undefined) {
  return canManageCatalog(role);
}
