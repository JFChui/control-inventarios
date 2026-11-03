import { describe, expect, it } from "vitest";
import { formatTurns, linenTurns } from "@/lib/linen/turns";

describe("vueltas de blancos", () => {
  it("divide la existencia activa entre 212 habitaciones por piezas", () => {
    expect(linenTurns(424, 0, 0, 212, 2)).toBe(1);
    expect(linenTurns(212, 212, 0, 212, 2)).toBe(1);
    expect(formatTurns(linenTurns(318, 0, 0, 212, 2))).toBe("0.8");
  });

  it("no calcula si faltan piezas por habitación", () => {
    expect(linenTurns(100, 0, 0, 212, 0)).toBeNull();
    expect(formatTurns(null)).toBe("—");
  });
});
