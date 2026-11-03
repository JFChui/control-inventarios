import { describe, expect, it } from "vitest";
import {
  dailyOccupancyPct,
  daysInMonth,
  formatMonthLabel,
  formatMonthShort,
  monthKeyFromDate,
  occupancyBarColor,
} from "@/lib/stats/occupancy";

describe("ocupación", () => {
  it("calcula el porcentaje diario", () => {
    expect(dailyOccupancyPct(10, 15, 100)).toBe(25);
    expect(dailyOccupancyPct(0, 0, 80)).toBe(0);
    expect(dailyOccupancyPct(40, 40, 80)).toBe(100);
    expect(dailyOccupancyPct(1, 0, 3)).toBe(33.33);
  });

  it("no divide por cero", () => {
    expect(dailyOccupancyPct(5, 5, 0)).toBe(0);
  });

  it("nombra el mes en español", () => {
    expect(formatMonthLabel("2026-01")).toBe("Enero 2026");
    expect(formatMonthLabel("2026-10")).toBe("Octubre 2026");
    expect(formatMonthShort("2026-10")).toBe("Oct 26");
  });

  it("extrae YYYY-MM y días del mes", () => {
    expect(monthKeyFromDate("2026-02-11")).toBe("2026-02");
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2024-02")).toBe(29);
  });

  it("asigna color sólido según el porcentaje", () => {
    expect(occupancyBarColor(0)).toBe("#d4d4d8");
    expect(occupancyBarColor(25)).toBe("#d97706");
    expect(occupancyBarColor(55)).toBe("#0d9488");
    expect(occupancyBarColor(80)).toBe("#0f766e");
    expect(occupancyBarColor(95)).toBe("#115e59");
  });
});
