import { describe, expect, it } from "vitest";
import {
  BULK_CATEGORY_REQUIRED,
  BULK_FIELDS_REQUIRED,
  CATEGORY_CODE_TAKEN,
  CATEGORY_FIELDS_REQUIRED,
  PRODUCT_CODE_TAKEN,
  PRODUCT_DEPARTMENT_SYNC_FAILED,
  PRODUCT_FIELDS_REQUIRED,
  PRODUCT_ID_REQUIRED,
  PRODUCT_MIN_STOCK_INVALID,
  isUniqueViolation,
  parseBulkMinUnit,
  parseCategoryWrite,
  parseProductWrite,
} from "@/lib/catalog/rules";

describe("parseCategoryWrite", () => {
  it("requires code and name", () => {
    expect(parseCategoryWrite({ code: "  ", name: "Amenidades" })).toEqual({
      ok: false,
      error: CATEGORY_FIELDS_REQUIRED,
    });
    expect(parseCategoryWrite({ code: "AMEN", name: "  " })).toEqual({
      ok: false,
      error: CATEGORY_FIELDS_REQUIRED,
    });
  });

  it("uppercases code and trims name", () => {
    expect(parseCategoryWrite({ code: " amen ", name: "  Amenidades  " })).toEqual({
      ok: true,
      id: null,
      code: "AMEN",
      name: "Amenidades",
    });
  });
});

describe("parseProductWrite", () => {
  it("requires code, name, category and unit", () => {
    expect(
      parseProductWrite({
        code: "",
        name: "Jabón",
        categoryId: "cat-1",
        unit: "unidad",
        minStock: 1,
      }),
    ).toEqual({ ok: false, error: PRODUCT_FIELDS_REQUIRED });
  });

  it("rejects negative min stock", () => {
    expect(
      parseProductWrite({
        code: "AM-001",
        name: "Jabón",
        categoryId: "cat-1",
        unit: "unidad",
        minStock: -1,
      }),
    ).toEqual({ ok: false, error: PRODUCT_MIN_STOCK_INVALID });
  });

  it("uppercases code and parses departments and is_active", () => {
    expect(
      parseProductWrite({
        id: "prod-1",
        code: " am-001 ",
        name: "  Jabón  ",
        categoryId: "cat-1",
        unit: " unidad ",
        minStock: "2.5",
        isActive: "false",
        departmentIds: ["d1", "", "d2", "d1"],
      }),
    ).toEqual({
      ok: true,
      id: "prod-1",
      code: "AM-001",
      name: "Jabón",
      categoryId: "cat-1",
      unit: "unidad",
      minStock: 2.5,
      isActive: false,
      departmentIds: ["d1", "d2"],
    });
  });

  it("requires id when updating", () => {
    expect(
      parseProductWrite(
        {
          code: "AM-001",
          name: "Jabón",
          categoryId: "cat-1",
          unit: "unidad",
          minStock: 0,
        },
        { requireId: true },
      ),
    ).toEqual({ ok: false, error: PRODUCT_ID_REQUIRED });
  });
});

describe("catalog uniqueness", () => {
  it("maps unique violation to Spanish code-taken messages", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(CATEGORY_CODE_TAKEN).toMatch(/categoría/i);
    expect(PRODUCT_CODE_TAKEN).toMatch(/producto/i);
    expect(PRODUCT_DEPARTMENT_SYNC_FAILED).toMatch(/departamentos/i);
  });
});

describe("parseBulkMinUnit", () => {
  it("requires a category", () => {
    expect(parseBulkMinUnit({ minStock: "5", unit: "GAL" })).toEqual({
      ok: false,
      error: BULK_CATEGORY_REQUIRED,
    });
  });

  it("requires min stock or unit", () => {
    expect(parseBulkMinUnit({ categoryId: "cat-1" })).toEqual({
      ok: false,
      error: BULK_FIELDS_REQUIRED,
    });
  });

  it("rejects negative min stock", () => {
    expect(
      parseBulkMinUnit({ categoryId: "cat-1", minStock: "-1" }),
    ).toEqual({ ok: false, error: PRODUCT_MIN_STOCK_INVALID });
  });

  it("allows unit-only or min-only updates", () => {
    expect(
      parseBulkMinUnit({
        categoryId: "cat-1",
        departmentId: "dept-1",
        unit: " GAL ",
      }),
    ).toEqual({
      ok: true,
      categoryId: "cat-1",
      departmentId: "dept-1",
      minStock: null,
      unit: "GAL",
    });
    expect(parseBulkMinUnit({ categoryId: "cat-1", minStock: "0" })).toEqual({
      ok: true,
      categoryId: "cat-1",
      departmentId: null,
      minStock: 0,
      unit: null,
    });
  });
});
