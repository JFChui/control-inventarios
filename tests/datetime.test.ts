import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  hotelMonth,
  hotelToday,
} from "@/lib/format/datetime";

describe("hotel calendar in America/Caracas", () => {
  it("keeps the local date after 20:00 UTC-4 (00:00 UTC next day)", () => {
    const evening = new Date("2026-10-12T23:30:00-04:00");
    expect(hotelToday(evening)).toBe("2026-10-12");
    expect(hotelMonth(evening)).toBe("2026-10");
  });

  it("rolls to the next day after midnight in Caracas", () => {
    const nextMorning = new Date("2026-10-13T00:15:00-04:00");
    expect(hotelToday(nextMorning)).toBe("2026-10-13");
  });

  it("formats timestamps in Caracas, not UTC", () => {
    const utcNoon = "2026-10-12T16:00:00.000Z";
    expect(formatDateTime(utcNoon)).toMatch(/12\/10\/2026/);
    expect(formatDate(utcNoon)).toBe("12/10/2026");
  });
});
