import { describe, expect, it } from "vitest";
import { countByPrefix, pdfCatalog } from "@/lib/catalog/pdf-catalog";
import { previewAllocation } from "@/lib/maid/preview";
import { nextMachineStatuses } from "@/lib/machines/transitions";
import { isMinorVariance } from "@/lib/physical/variance";
import { monthlyVariationPct } from "@/lib/stats/variation";
import { uniformBalances } from "@/lib/uniforms/balance";

describe("catálogo del PDF", () => {
  it("cuenta los prefijos de la transcripción", () => {
    expect(countByPrefix()).toEqual({
      STY: 45,
      LENC: 36,
      LAV: 46,
      SUM: 100,
    });
    expect(new Set(pdfCatalog.map((item) => item.code)).size).toBe(
      pdfCatalog.length,
    );
  });
});

describe("inventario físico", () => {
  it("marca diferencia menor por 5 unidades o 5%", () => {
    expect(isMinorVariance(100, 100)).toBe(true);
    expect(isMinorVariance(100, 95)).toBe(true);
    expect(isMinorVariance(1000, 960)).toBe(true);
    expect(isMinorVariance(100, 90)).toBe(false);
    expect(isMinorVariance(0, 5)).toBe(true);
    expect(isMinorVariance(0, 6)).toBe(false);
  });
});

describe("dotación", () => {
  it("separa amenidades y lencería desde los parámetros", () => {
    const preview = previewAllocation(
      [
        { roomType: "standard", serviceType: "ocupacion" },
        { roomType: "standard", serviceType: "ocupacion" },
      ],
      [
        {
          productCode: "SUM00082",
          productName: "Shampoo",
          categoryCode: "AMEN",
          roomType: "standard",
          serviceType: "ocupacion",
          qtyPerRoom: 2,
        },
        {
          productCode: "LENC00046",
          productName: "Sábanas",
          categoryCode: "BLAN",
          roomType: "standard",
          serviceType: "ocupacion",
          qtyPerRoom: 1,
        },
      ],
    );

    expect(preview.amenidades).toEqual([
      {
        code: "SUM00082",
        name: "Shampoo",
        categoryCode: "AMEN",
        qty: 4,
      },
    ]);
    expect(preview.lenceria[0]?.qty).toBe(2);
    expect(preview.otros).toEqual([]);
  });

  it("multiplica por el conteo de habitaciones por estatus", () => {
    const preview = previewAllocation(
      [{ roomType: "standard", serviceType: "salida", count: 5 }],
      [
        {
          productCode: "SUM00082",
          productName: "Shampoo",
          categoryCode: "AMEN",
          roomType: "standard",
          serviceType: "salida",
          qtyPerRoom: 2,
        },
      ],
    );
    expect(preview.amenidades[0]?.qty).toBe(10);
  });

  it("acepta inspected, clean, dirty y out of order", () => {
    const preview = previewAllocation(
      [{ roomType: "standard", serviceType: "dirty", count: 3 }],
      [
        {
          productCode: "SUM00082",
          productName: "Shampoo",
          categoryCode: "AMEN",
          roomType: "standard",
          serviceType: "dirty",
          qtyPerRoom: 1,
        },
      ],
    );
    expect(preview.amenidades[0]?.qty).toBe(3);
  });
});

describe("uniformes", () => {
  it("exige disponible + en uso + no utilizable = total", () => {
    expect(uniformBalances(3, 2, 5)).toBe(true);
    expect(uniformBalances(3, 2, 6)).toBe(false);
    expect(uniformBalances(3, 2, 6, 1)).toBe(true);
  });
});

describe("maquinaria", () => {
  it("solo permite la cadena de estados del ticket", () => {
    expect(nextMachineStatuses("reportada")).toEqual(["entregada"]);
    expect(nextMachineStatuses("en_reparacion")).toEqual([
      "reparada",
      "fuera_de_servicio",
    ]);
    expect(nextMachineStatuses("reparada")).toEqual([]);
  });
});

describe("estadísticas", () => {
  it("calcula la variación contra el mes anterior", () => {
    expect(monthlyVariationPct(150, 100)).toBe(50);
    expect(monthlyVariationPct(50, 100)).toBe(-50);
    expect(monthlyVariationPct(10, 0)).toBeNull();
    expect(monthlyVariationPct(10, null)).toBeNull();
  });
});
