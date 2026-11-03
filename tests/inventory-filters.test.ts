import { describe, expect, it } from "vitest";
import { parseInventoryFilters, sanitizeIlike } from "@/lib/catalog/filters";

describe("parseInventoryFilters", () => {
  it("defaults to active products only", () => {
    expect(parseInventoryFilters({})).toEqual({
      q: "",
      category: "",
      department: "",
      status: "",
      activeOnly: true,
    });
  });

  it("includes inactives when activos=0 or status is inactivo", () => {
    expect(parseInventoryFilters({ activos: "0" }).activeOnly).toBe(false);
    expect(parseInventoryFilters({ status: "inactivo" }).activeOnly).toBe(
      false,
    );
  });

  it("ignores unknown status values", () => {
    expect(parseInventoryFilters({ status: "hack" }).status).toBe("");
    expect(parseInventoryFilters({ status: "sin_conteo" }).status).toBe(
      "sin_conteo",
    );
  });
});

describe("sanitizeIlike", () => {
  it("strips wildcard and grouping characters", () => {
    expect(sanitizeIlike("%foo_bar,(x)")).toBe("foobarx");
  });
});
