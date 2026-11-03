import { afterEach, describe, expect, it, vi } from "vitest";
import { stripIds, toActionError } from "@/lib/actions/errors";
import {
  parseIsoDate,
  parseNonNegativeNumber,
  parseOptionalText,
  parsePositiveNumber,
  parseRequiredText,
} from "@/lib/actions/parse";

describe("parse helpers", () => {
  it("rejects a blank counted quantity instead of coercing to 0", () => {
    expect(parseNonNegativeNumber("", "la cantidad contada")).toEqual({
      ok: false,
      error: "Indica la cantidad contada.",
    });
    expect(parseNonNegativeNumber("  ", "la cantidad contada")).toMatchObject({
      ok: false,
    });
    expect(parseNonNegativeNumber("0", "la cantidad contada")).toEqual({
      ok: true,
      value: 0,
    });
  });

  it("rejects non-positive quantities", () => {
    expect(parsePositiveNumber("0", "la cantidad")).toEqual({
      ok: false,
      error: "la cantidad debe ser mayor a 0.",
    });
    expect(parsePositiveNumber("2.5", "la cantidad")).toEqual({
      ok: true,
      value: 2.5,
    });
  });

  it("validates ISO dates and bounded text", () => {
    expect(parseIsoDate("12/10/2026")).toMatchObject({ ok: false });
    expect(parseIsoDate("2026-10-12")).toEqual({
      ok: true,
      value: "2026-10-12",
    });
    expect(parseRequiredText("  ", "Nombre")).toMatchObject({ ok: false });
    expect(parseRequiredText("Ana", "Nombre")).toEqual({
      ok: true,
      value: "Ana",
    });
    expect(parseOptionalText("", "Notas")).toEqual({ ok: true, value: null });
    expect(parseOptionalText("x".repeat(501), "Notas", 500)).toMatchObject({
      ok: false,
    });
  });
});

describe("toActionError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("translates Postgres codes and strips UUIDs from raised exceptions", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toActionError({ code: "23505", message: "duplicate" }, "x")).toBe(
      "Ya existe un registro con esos datos.",
    );
    expect(toActionError({ code: "23503", message: "fk" }, "x")).toBe(
      "No se puede completar: hay datos relacionados.",
    );
    expect(toActionError({ code: "42501", message: "denied" }, "x")).toBe(
      "No tienes permiso para esta operación.",
    );
    expect(
      toActionError(
        {
          message:
            "Stock insuficiente o producto inactivo: 11111111-1111-4111-8111-111111111111",
        },
        "fallback",
      ),
    ).toBe("Stock insuficiente o producto inactivo:");
    expect(stripIds("id 11111111-1111-4111-8111-111111111111 extra")).toBe(
      "id extra",
    );
    expect(spy).toHaveBeenCalled();
  });
});
