const SPACE_RE = /\s+/g;

export const EMPLOYMENT_TYPES = ["fijo", "eventual"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  fijo: "Fijo",
  eventual: "Eventual",
};

export type UniformWorker = {
  id: string;
  uniform_code: string;
  last_name: string;
  first_name: string;
  staff_department: string;
  position: string;
  is_active: boolean;
  employment_type?: EmploymentType | string;
};

export type UniformWorkerFilters = {
  q: string;
  staffDept: string;
  activeOnly: boolean;
  employmentType: string;
};

export function collapseSpaces(value: string) {
  return value.trim().replace(SPACE_RE, " ");
}

export function normalizeWorkerField(value: string) {
  return collapseSpaces(value).toUpperCase();
}

export function workerFullName(worker: Pick<UniformWorker, "last_name" | "first_name">) {
  return collapseSpaces(`${worker.last_name} ${worker.first_name}`);
}

export function formatWorkerDisplayName(
  worker: Pick<UniformWorker, "uniform_code" | "last_name" | "first_name">,
) {
  return `${worker.uniform_code} — ${workerFullName(worker)}`;
}

export function formatWorkerOptionLabel(
  worker: Pick<
    UniformWorker,
    "uniform_code" | "last_name" | "first_name" | "staff_department"
  >,
) {
  return `${formatWorkerDisplayName(worker)} (${worker.staff_department})`;
}

export function parseUniformWorkerFilters(sp: {
  q?: string;
  staff_dept?: string;
  activos?: string;
  employment?: string;
}): UniformWorkerFilters {
  const activos = sp.activos ?? "1";
  const employment = collapseSpaces(String(sp.employment ?? "")).toLowerCase();
  return {
    q: collapseSpaces(String(sp.q ?? "")),
    staffDept: collapseSpaces(String(sp.staff_dept ?? "")),
    activeOnly: activos !== "0" && activos !== "all",
    employmentType: EMPLOYMENT_TYPES.includes(employment as EmploymentType)
      ? employment
      : "",
  };
}

export function workerMatchesQuery(
  worker: Pick<UniformWorker, "uniform_code" | "last_name" | "first_name">,
  q: string,
) {
  const needle = collapseSpaces(q).toLowerCase();
  if (!needle) return true;
  const haystack =
    `${worker.uniform_code} ${worker.last_name} ${worker.first_name}`.toLowerCase();
  return haystack.includes(needle);
}

export function resolveWorkerId(
  workers: Pick<
    UniformWorker,
    "id" | "uniform_code" | "last_name" | "first_name" | "staff_department"
  >[],
  workerId: string,
  typedValue: string,
) {
  const id = collapseSpaces(workerId);
  if (id && workers.some((worker) => worker.id === id)) return id;

  const typed = collapseSpaces(typedValue);
  if (!typed) return "";

  const byOption = workers.find(
    (worker) => formatWorkerOptionLabel(worker) === typed,
  );
  if (byOption) return byOption.id;

  const byCode = workers.filter(
    (worker) => worker.uniform_code.toLowerCase() === typed.toLowerCase(),
  );
  return byCode.length === 1 ? byCode[0].id : "";
}
