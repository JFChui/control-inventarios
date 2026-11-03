import { describe, expect, it } from "vitest";
import { canAccessModule } from "@/lib/auth/modules";
import {
  canManageCatalog,
  canManageDepartments,
  canManageUniforms,
  canManageUsers,
  canWriteAllocation,
  canWriteLinen,
  canWriteMachineTickets,
  canWriteMovements,
  canWritePhysicalCount,
} from "@/lib/auth/roles";

describe("acceso por cargo", () => {
  it("gerentes de Diseño y Estilo acceden a todo", () => {
    expect(canManageCatalog("senior_design_manager")).toBe(true);
    expect(canManageCatalog("design_manager")).toBe(true);
    expect(canWriteMovements("design_manager")).toBe(true);
    expect(canManageUsers("senior_design_manager")).toBe(true);
    expect(canManageDepartments("design_manager")).toBe(true);
    expect(canAccessModule("design_manager", "estadisticas")).toBe(true);
  });

  it("RR.HH. solo ve dashboard y uniformes", () => {
    expect(canAccessModule("hr_manager", "dashboard")).toBe(true);
    expect(canManageUniforms("hr_manager")).toBe(true);
    expect(canWriteMovements("hr_manager")).toBe(false);
    expect(canAccessModule("hr_manager", "inventario")).toBe(false);
    expect(canManageUsers("hr_manager")).toBe(false);
  });

  it("supervisor de lavandería ve blancos, uniformes y maquinaria", () => {
    expect(canWriteLinen("laundry_supervisor")).toBe(true);
    expect(canManageUniforms("laundry_supervisor")).toBe(true);
    expect(canWriteMachineTickets("laundry_supervisor")).toBe(true);
    expect(canAccessModule("laundry_supervisor", "inventario")).toBe(false);
    expect(canAccessModule("laundry_supervisor", "linner_recepcion")).toBe(false);
    expect(canWriteMovements("laundry_supervisor")).toBe(false);
  });

  it("supervisores de piso y MRLA operan inventario, físico, reportes, alertas y dotación", () => {
    for (const role of [
      "floor_supervisor_a",
      "floor_supervisor_b",
      "floor_supervisor_c",
      "mrla",
    ] as const) {
      expect(canAccessModule(role, "inventario")).toBe(true);
      expect(canWritePhysicalCount(role)).toBe(true);
      expect(canWriteAllocation(role)).toBe(true);
      expect(canAccessModule(role, "reportes")).toBe(true);
      expect(canAccessModule(role, "alertas")).toBe(true);
      expect(canAccessModule(role, "linner_recepcion")).toBe(true);
      expect(canWriteMovements(role)).toBe(false);
      expect(canManageUsers(role)).toBe(false);
      expect(canAccessModule(role, "estadisticas")).toBe(false);
      expect(canAccessModule(role, "blancos")).toBe(false);
    }
  });
});
