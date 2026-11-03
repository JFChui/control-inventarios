import { describe, expect, it } from "vitest";
import { classifyStock, stockBadge } from "@/lib/stock/status";

describe("classifyStock", () => {
  it("sin_conteo when never initialized", () => {
    expect(classifyStock(0, 0, false)).toBe("sin_conteo");
    expect(classifyStock(40, 10, false)).toBe("sin_conteo");
  });

  it("agotado when qty <= 0 and initialized", () => {
    expect(classifyStock(0, 10)).toBe("agotado");
    expect(classifyStock(0, 0, true)).toBe("agotado");
  });

  it("does not use bajo/proximo when min is not configured", () => {
    expect(classifyStock(8, 0, true)).toBe("normal");
    expect(classifyStock(1, -1, true)).toBe("normal");
  });

  it("bajo when qty <= min", () => {
    expect(classifyStock(5, 10)).toBe("bajo");
  });

  it("proximo when qty <= min * 1.25", () => {
    expect(classifyStock(12, 10)).toBe("proximo");
  });

  it("normal above threshold", () => {
    expect(classifyStock(20, 10)).toBe("normal");
  });
});

describe("stockBadge", () => {
  it("marks inactive products regardless of stock", () => {
    expect(stockBadge(0, 0, false, false)).toMatchObject({
      label: "Inactivo",
      status: "inactivo",
    });
  });

  it("uses sin_conteo label for uninitialized active products", () => {
    expect(stockBadge(0, 0, false, true)).toMatchObject({
      label: "Sin conteo",
      status: "sin_conteo",
    });
  });
});
