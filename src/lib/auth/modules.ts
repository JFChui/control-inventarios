export type AppRole =
  | "senior_design_manager"
  | "design_manager"
  | "hr_manager"
  | "laundry_supervisor"
  | "floor_supervisor_a"
  | "floor_supervisor_b"
  | "floor_supervisor_c"
  | "mrla"
  | "admin"
  | "human_resources"
  | "department_user";

export type ModuleKey =
  | "dashboard"
  | "inventario"
  | "movimientos"
  | "alertas"
  | "categorias"
  | "blancos"
  | "dotacion"
  | "inventario_fisico"
  | "uniformes"
  | "maquinaria"
  | "reportes"
  | "estadisticas"
  | "departamentos"
  | "usuarios"
  | "linner_recepcion";

export const ASSIGNABLE_ROLES = [
  "senior_design_manager",
  "design_manager",
  "hr_manager",
  "laundry_supervisor",
  "floor_supervisor_a",
  "floor_supervisor_b",
  "floor_supervisor_c",
  "mrla",
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  senior_design_manager: "Gerente Senior de Diseño y Estilo",
  design_manager: "Gerente de Diseño y Estilo",
  hr_manager: "Gerente de Recursos Humanos",
  laundry_supervisor: "Supervisor de lavandería",
  floor_supervisor_a: "Supervisor de piso A",
  floor_supervisor_b: "Supervisor de piso B",
  floor_supervisor_c: "Supervisor de piso C",
  mrla: "MRLA",
  admin: "Administrador (legado)",
  human_resources: "Recursos humanos (legado)",
  department_user: "Usuario de departamento (legado)",
};

const ALL_MODULES: ModuleKey[] = [
  "dashboard",
  "inventario",
  "movimientos",
  "alertas",
  "categorias",
  "blancos",
  "dotacion",
  "inventario_fisico",
  "uniformes",
  "maquinaria",
  "reportes",
  "estadisticas",
  "departamentos",
  "usuarios",
  "linner_recepcion",
];

const FLOOR_MODULES: ModuleKey[] = [
  "dashboard",
  "inventario",
  "inventario_fisico",
  "reportes",
  "alertas",
  "dotacion",
  "linner_recepcion",
];

const MODULE_ACCESS: Record<AppRole, readonly ModuleKey[]> = {
  senior_design_manager: ALL_MODULES,
  design_manager: ALL_MODULES,
  admin: ALL_MODULES,
  hr_manager: ["dashboard", "uniformes"],
  human_resources: ["dashboard", "uniformes"],
  laundry_supervisor: ["dashboard", "blancos", "uniformes", "maquinaria"],
  floor_supervisor_a: FLOOR_MODULES,
  floor_supervisor_b: FLOOR_MODULES,
  floor_supervisor_c: FLOOR_MODULES,
  department_user: FLOOR_MODULES,
  mrla: FLOOR_MODULES,
};

export function canAccessModule(
  role: AppRole | null | undefined,
  module: ModuleKey,
): boolean {
  if (!role) return false;
  return MODULE_ACCESS[role].includes(module);
}

export function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: AppRole | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}
