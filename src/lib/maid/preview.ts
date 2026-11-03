export type AllocationRoom = {
  roomType: string;
  serviceType: string;
  count?: number;
};

export type SupplyParam = {
  productCode: string;
  productName: string;
  categoryCode: string;
  roomType: string;
  serviceType: string;
  qtyPerRoom: number;
};

export type PreviewLine = {
  code: string;
  name: string;
  categoryCode: string;
  qty: number;
};

export const SERVICE_TYPES = [
  "ocupacion",
  "salida",
  "limpieza",
  "inspected",
  "clean",
  "dirty",
  "out_of_order",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_LABELS: Record<ServiceType, string> = {
  ocupacion: "Ocupación",
  salida: "Salida",
  limpieza: "Limpieza",
  inspected: "Inspected",
  clean: "Clean",
  dirty: "Dirty",
  out_of_order: "Out of order",
};

export function emptyByService(): Record<ServiceType, number> {
  return {
    ocupacion: 0,
    salida: 0,
    limpieza: 0,
    inspected: 0,
    clean: 0,
    dirty: 0,
    out_of_order: 0,
  };
}

export type PreviewMatrixLine = PreviewLine & {
  byService: Record<ServiceType, number>;
};

export function previewAllocation(
  rooms: AllocationRoom[],
  params: SupplyParam[],
): { amenidades: PreviewLine[]; lenceria: PreviewLine[]; otros: PreviewLine[] } {
  const totals = new Map<string, PreviewLine>();

  for (const room of rooms) {
    const count = room.count ?? 1;
    if (count <= 0) continue;
    for (const param of params) {
      if (
        param.roomType !== room.roomType ||
        param.serviceType !== room.serviceType ||
        param.qtyPerRoom <= 0
      ) {
        continue;
      }
      const prev = totals.get(param.productCode) ?? {
        code: param.productCode,
        name: param.productName,
        categoryCode: param.categoryCode,
        qty: 0,
      };
      prev.qty += param.qtyPerRoom * count;
      totals.set(param.productCode, prev);
    }
  }

  const lines = Array.from(totals.values());
  return splitPreview(lines);
}

export function previewAllocationMatrix(
  rooms: AllocationRoom[],
  params: SupplyParam[],
): {
  amenidades: PreviewMatrixLine[];
  lenceria: PreviewMatrixLine[];
  otros: PreviewMatrixLine[];
} {
  const totals = new Map<string, PreviewMatrixLine>();

  for (const room of rooms) {
    const count = room.count ?? 1;
    if (count <= 0) continue;
    const service = room.serviceType as ServiceType;
    if (!SERVICE_TYPES.includes(service)) continue;
    for (const param of params) {
      if (
        param.roomType !== room.roomType ||
        param.serviceType !== room.serviceType ||
        param.qtyPerRoom <= 0
      ) {
        continue;
      }
      const prev = totals.get(param.productCode) ?? {
        code: param.productCode,
        name: param.productName,
        categoryCode: param.categoryCode,
        qty: 0,
        byService: emptyByService(),
      };
      const add = param.qtyPerRoom * count;
      prev.byService[service] += add;
      prev.qty += add;
      totals.set(param.productCode, prev);
    }
  }

  const lines = Array.from(totals.values());
  return {
    amenidades: lines.filter((line) => line.categoryCode === "AMEN"),
    lenceria: lines.filter((line) => line.categoryCode === "BLAN"),
    otros: lines.filter(
      (line) => line.categoryCode !== "AMEN" && line.categoryCode !== "BLAN",
    ),
  };
}

function splitPreview(lines: PreviewLine[]) {
  return {
    amenidades: lines.filter((line) => line.categoryCode === "AMEN"),
    lenceria: lines.filter((line) => line.categoryCode === "BLAN"),
    otros: lines.filter(
      (line) => line.categoryCode !== "AMEN" && line.categoryCode !== "BLAN",
    ),
  };
}
