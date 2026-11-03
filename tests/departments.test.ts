import { describe, expect, it } from "vitest";
import {
  DEPARTMENT_CODE_TAKEN,
  DEPARTMENT_DELETE_BLOCKED,
  DEPARTMENT_FIELDS_REQUIRED,
  hasDepartmentReferences,
  isCodeTaken,
  isForeignKeyViolation,
  isUniqueViolation,
  normalizeDepartmentCode,
  parseDepartmentWrite,
} from "@/lib/departments/rules";

describe("normalizeDepartmentCode", () => {
  it("trims and uppercases the code", () => {
    expect(normalizeDepartmentCode("  ama ")).toBe("AMA");
  });
});

describe("parseDepartmentWrite", () => {
  it("requires code and name", () => {
    expect(parseDepartmentWrite({ code: "  ", name: "Ama" })).toEqual({
      ok: false,
      error: DEPARTMENT_FIELDS_REQUIRED,
    });
    expect(parseDepartmentWrite({ code: "AMA", name: "   " })).toEqual({
      ok: false,
      error: DEPARTMENT_FIELDS_REQUIRED,
    });
  });

  it("uppercases code and trims name", () => {
    expect(parseDepartmentWrite({ code: "ama", name: "  Ama de Llaves  " })).toEqual({
      ok: true,
      code: "AMA",
      name: "Ama de Llaves",
      isActive: true,
    });
  });

  it("parses is_active from form values", () => {
    expect(
      parseDepartmentWrite({ code: "AMA", name: "Ama", isActive: "false" }),
    ).toMatchObject({ ok: true, isActive: false });
    expect(
      parseDepartmentWrite({ code: "AMA", name: "Ama", isActive: "true" }),
    ).toMatchObject({ ok: true, isActive: true });
  });
});

describe("department uniqueness", () => {
  it("treats an existing other row as taken", () => {
    expect(isCodeTaken("other-id")).toBe(true);
    expect(isCodeTaken("same-id", "same-id")).toBe(false);
    expect(isCodeTaken(null)).toBe(false);
  });

  it("maps unique violation to the Spanish code-taken message", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(DEPARTMENT_CODE_TAKEN).toMatch(/código/i);
  });
});

describe("department delete vs deactivate", () => {
  it("blocks delete when movements, profiles, product_departments or requests exist", () => {
    expect(
      hasDepartmentReferences({
        movements: 0,
        profiles: 0,
        productDepartments: 0,
        supplyRequests: 0,
      }),
    ).toBe(false);
    expect(
      hasDepartmentReferences({
        movements: 1,
        profiles: 0,
        productDepartments: 0,
        supplyRequests: 0,
      }),
    ).toBe(true);
    expect(
      hasDepartmentReferences({
        movements: 0,
        profiles: 2,
        productDepartments: 0,
        supplyRequests: 0,
      }),
    ).toBe(true);
    expect(
      hasDepartmentReferences({
        movements: 0,
        profiles: 0,
        productDepartments: 1,
        supplyRequests: 0,
      }),
    ).toBe(true);
    expect(
      hasDepartmentReferences({
        movements: 0,
        profiles: 0,
        productDepartments: 0,
        supplyRequests: 3,
      }),
    ).toBe(true);
  });

  it("maps FK errors to a Spanish deactivate message", () => {
    expect(isForeignKeyViolation({ code: "23503" })).toBe(true);
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
    expect(DEPARTMENT_DELETE_BLOCKED).toMatch(/desactiv/i);
  });
});
