import { describe, expect, it } from "vitest";
import {
  collapseSpaces,
  formatWorkerDisplayName,
  formatWorkerOptionLabel,
  normalizeWorkerField,
  parseUniformWorkerFilters,
  resolveWorkerId,
  workerFullName,
  workerMatchesQuery,
} from "@/lib/uniforms/workers";

const worker = {
  id: "w-1001",
  uniform_code: "1001",
  last_name: "GARCIA LOPEZ",
  first_name: "ANA MARIA",
  staff_department: "ESTILO",
};

describe("normalize worker fields from Excel", () => {
  it("collapses double spaces and trims cargo", () => {
    expect(collapseSpaces("ANA  MARIA")).toBe("ANA MARIA");
    expect(collapseSpaces("GARCIA LOPEZ / ANA  MARIA ")).toBe(
      "GARCIA LOPEZ / ANA MARIA",
    );
    expect(normalizeWorkerField(" AUXILIAR DE PISO")).toBe("AUXILIAR DE PISO");
  });

  it("builds the visible assignment name as code — last first", () => {
    expect(formatWorkerDisplayName(worker)).toBe("1001 — GARCIA LOPEZ ANA MARIA");
    expect(formatWorkerOptionLabel(worker)).toBe(
      "1001 — GARCIA LOPEZ ANA MARIA (ESTILO)",
    );
    expect(workerFullName(worker)).toBe("GARCIA LOPEZ ANA MARIA");
  });
});

describe("worker search and form resolve", () => {
  it("defaults to active-only filters", () => {
    expect(parseUniformWorkerFilters({})).toEqual({
      q: "",
      staffDept: "",
      activeOnly: true,
      employmentType: "",
    });
    expect(parseUniformWorkerFilters({ activos: "0" }).activeOnly).toBe(false);
  });

  it("matches code or name", () => {
    expect(workerMatchesQuery(worker, "1001")).toBe(true);
    expect(workerMatchesQuery(worker, "garcia")).toBe(true);
    expect(workerMatchesQuery(worker, "ana")).toBe(true);
    expect(workerMatchesQuery(worker, "9999")).toBe(false);
  });

  it("resolves worker_id from hidden id, option label or unique code", () => {
    expect(resolveWorkerId([worker], "w-1001", "")).toBe("w-1001");
    expect(
      resolveWorkerId([worker], "", formatWorkerOptionLabel(worker)),
    ).toBe("w-1001");
    expect(resolveWorkerId([worker], "", "1001")).toBe("w-1001");
    expect(resolveWorkerId([worker], "", "no existe")).toBe("");
  });
});
