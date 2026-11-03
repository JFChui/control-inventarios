import {
  AdjustUniformForm,
  AssignUniformForm,
  CreateUniformForm,
  CreateUniformWorkerForm,
  MarkAssignmentUnusableButton,
  MarkUnusableForm,
  ReturnUniformButton,
  SetWorkerEmploymentForm,
  ToggleWorkerActiveButton,
} from "@/components/uniforms/uniforms-forms";
import { PageHeader } from "@/components/ui/page-header";
import {
  canAssignUniforms,
  canManageUniforms,
} from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format/datetime";
import { createClient } from "@/lib/supabase/server";
import {
  EMPLOYMENT_LABELS,
  formatWorkerDisplayName,
  parseUniformWorkerFilters,
  workerFullName,
  workerMatchesQuery,
  type EmploymentType,
} from "@/lib/uniforms/workers";

type Search = {
  size?: string;
  dept?: string;
  worker?: string;
  q?: string;
  staff_dept?: string;
  activos?: string;
  employment?: string;
};

export default async function UniformesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const workerFilters = parseUniformWorkerFilters(sp);
  const { profile } = await requireModule("uniformes");
  const supabase = await createClient();
  const canManage = canManageUniforms(profile?.role);
  const canAssign = canAssignUniforms(profile?.role);

  let skusQuery = supabase
    .from("uniform_skus")
    .select(
      "id, code, name, size, total, available, in_use, unusable, department_id, departments(code, name)",
    )
    .order("code");

  if (sp.size) skusQuery = skusQuery.eq("size", sp.size);
  if (sp.dept) skusQuery = skusQuery.eq("department_id", sp.dept);

  const [
    { data: skus },
    { data: departments },
    { data: assignments },
    { data: openQty },
    { data: workers },
  ] = await Promise.all([
    skusQuery,
    supabase.from("departments").select("id, code, name").order("code"),
    supabase
      .from("uniform_assignments")
      .select(
        "id, worker_name, worker_id, quantity, assigned_at, returned_at, sku_id, uniform_skus(code, name, size), uniform_workers(uniform_code, last_name, first_name)",
      )
      .order("assigned_at", { ascending: false })
      .limit(80),
    supabase
      .from("uniform_assignments")
      .select("sku_id, worker_id, quantity, uniform_workers(employment_type)")
      .is("returned_at", null),
    supabase
      .from("uniform_workers")
      .select(
        "id, uniform_code, last_name, first_name, staff_department, position, is_active, employment_type",
      )
      .order("last_name"),
  ]);

  const sizes = Array.from(
    new Set((skus ?? []).map((s) => s.size).filter(Boolean)),
  ).sort();
  const staffDepartments = Array.from(
    new Set((workers ?? []).map((w) => w.staff_department).filter(Boolean)),
  ).sort();

  const workerFilter = (sp.worker ?? "").trim().toLowerCase();
  const matchingWorkerIds = new Set(
    (workers ?? [])
      .filter((worker) => workerMatchesQuery(worker, workerFilter))
      .map((worker) => worker.id),
  );

  const piecesInUse = new Map<string, number>();
  const skuGroups = new Map<string, { fijo: number; eventual: number }>();
  for (const assignment of openQty ?? []) {
    if (assignment.worker_id) {
      piecesInUse.set(
        assignment.worker_id,
        (piecesInUse.get(assignment.worker_id) ?? 0) + Number(assignment.quantity),
      );
    }
    const roster = Array.isArray(assignment.uniform_workers)
      ? assignment.uniform_workers[0]
      : assignment.uniform_workers;
    const type = roster?.employment_type === "eventual" ? "eventual" : "fijo";
    const prev = skuGroups.get(assignment.sku_id) ?? { fijo: 0, eventual: 0 };
    prev[type] += Number(assignment.quantity);
    skuGroups.set(assignment.sku_id, prev);
  }

  const openAssignments = (assignments ?? [])
    .filter((assignment) => assignment.returned_at == null)
    .filter((assignment) => {
      if (!workerFilter) return true;
      if (assignment.worker_id && matchingWorkerIds.has(assignment.worker_id)) {
        return true;
      }
      return assignment.worker_name.toLowerCase().includes(workerFilter);
    })
    .map((a) => {
      const sku = Array.isArray(a.uniform_skus)
        ? a.uniform_skus[0]
        : a.uniform_skus;
      const roster = Array.isArray(a.uniform_workers)
        ? a.uniform_workers[0]
        : a.uniform_workers;
      return {
        id: a.id,
        sku_id: a.sku_id,
        worker_name: roster
          ? formatWorkerDisplayName(roster)
          : a.worker_name,
        worker_code: roster?.uniform_code ?? null,
        quantity: Number(a.quantity),
        assigned_at: a.assigned_at,
        uniform_skus: sku
          ? { code: sku.code, name: sku.name, size: sku.size }
          : null,
      };
    });

  const visibleWorkers = (workers ?? []).filter((worker) => {
    if (workerFilters.activeOnly && !worker.is_active) return false;
    if (
      workerFilters.staffDept &&
      worker.staff_department !== workerFilters.staffDept
    ) {
      return false;
    }
    if (
      workerFilters.employmentType &&
      worker.employment_type !== workerFilters.employmentType
    ) {
      return false;
    }
    return workerMatchesQuery(worker, workerFilters.q);
  });

  const activeWorkers = (workers ?? []).filter((worker) => worker.is_active);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Uniformes"
        description="Total = fijos + eventuales + RR.HH. + no utilizables. El padrón marca si el trabajador es fijo o eventual."
      />

      <form className="flex flex-wrap gap-2" method="get">
        <select
          name="size"
          defaultValue={sp.size ?? ""}
          className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="">Todas las tallas</option>
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="dept"
          defaultValue={sp.dept ?? ""}
          className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="">Todos los deptos. de inventario</option>
          {(departments ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.code}
            </option>
          ))}
        </select>
        <input
          name="worker"
          defaultValue={sp.worker ?? ""}
          placeholder="Trabajador (asignaciones)"
          className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
        />
        <input
          name="q"
          defaultValue={workerFilters.q}
          placeholder="Código o nombre"
          className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
        />
        <select
          name="staff_dept"
          defaultValue={workerFilters.staffDept}
          className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="">Todos los deptos. del hotel</option>
          {staffDepartments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
        <select
          name="employment"
          defaultValue={workerFilters.employmentType}
          className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="">Fijos y eventuales</option>
          <option value="fijo">Solo fijos</option>
          <option value="eventual">Solo eventuales</option>
        </select>
        <select
          name="activos"
          defaultValue={sp.activos ?? "1"}
          className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="1">Solo activos</option>
          <option value="0">Incluir bajas</option>
        </select>
        <button
          type="submit"
          className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
        >
          Filtrar
        </button>
      </form>

      {canManage ? <CreateUniformForm departments={departments ?? []} /> : null}
      {canManage ? (
        <AdjustUniformForm
          skus={(skus ?? []).map((sku) => ({
            id: sku.id,
            code: sku.code,
            name: sku.name,
            size: sku.size,
            available: Number(sku.available),
          }))}
        />
      ) : null}
      {canAssign ? (
        <AssignUniformForm
          skus={(skus ?? []).map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            size: s.size,
            available: Number(s.available),
          }))}
          workers={activeWorkers.map((worker) => ({
            id: worker.id,
            uniform_code: worker.uniform_code,
            last_name: worker.last_name,
            first_name: worker.first_name,
            staff_department: worker.staff_department,
          }))}
        />
      ) : null}
      {canManage ? (
        <CreateUniformWorkerForm staffDepartments={staffDepartments} />
      ) : null}
      {canManage ? (
        <MarkUnusableForm
          skus={(skus ?? []).map((sku) => ({
            id: sku.id,
            code: sku.code,
            name: sku.name,
            size: sku.size,
            available: Number(sku.available),
          }))}
        />
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">
          Trabajadores
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {visibleWorkers.length} de {workers?.length ?? 0}
          </span>
        </h2>
        {visibleWorkers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No hay trabajadores con ese filtro.
          </p>
        ) : (
          <>
            <ul className="mt-3 space-y-3 md:hidden">
              {visibleWorkers.map((worker) => (
                <li
                  key={worker.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-medium">{workerFullName(worker)}</p>
                  <p className="font-mono text-xs text-zinc-500">
                    {worker.uniform_code}
                    {!worker.is_active ? " · baja" : ""}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    {worker.staff_department} · {worker.position} ·{" "}
                    {EMPLOYMENT_LABELS[(worker.employment_type as EmploymentType) ?? "fijo"] ??
                      "Fijo"}
                  </p>
                  <p className="mt-1 text-sm">
                    Piezas en uso:{" "}
                    <span className="tabular-nums font-medium">
                      {piecesInUse.get(worker.id) ?? 0}
                    </span>
                  </p>
                  {canManage ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <SetWorkerEmploymentForm
                        workerId={worker.id}
                        employmentType={worker.employment_type ?? "fijo"}
                      />
                      <ToggleWorkerActiveButton
                        workerId={worker.id}
                        isActive={worker.is_active}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-3 hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Código</th>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Depto. hotel</th>
                    <th className="px-4 py-3 font-medium">Cargo</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">En uso</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    {canManage ? (
                      <th className="px-4 py-3 font-medium">Acción</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {visibleWorkers.map((worker) => (
                    <tr key={worker.id} className="border-t border-zinc-100">
                      <td className="px-4 py-3 font-mono text-xs">
                        {worker.uniform_code}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {workerFullName(worker)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {worker.staff_department}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {worker.position}
                      </td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <SetWorkerEmploymentForm
                            workerId={worker.id}
                            employmentType={worker.employment_type ?? "fijo"}
                          />
                        ) : (
                          EMPLOYMENT_LABELS[
                            (worker.employment_type as EmploymentType) ?? "fijo"
                          ] ?? "Fijo"
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {piecesInUse.get(worker.id) ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        {worker.is_active ? "Activo" : "Baja"}
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <ToggleWorkerActiveButton
                            workerId={worker.id}
                            isActive={worker.is_active}
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Prendas</h2>
        {(skus ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Todavía no hay prendas registradas. Use <strong>Registrar uniforme</strong>{" "}
            para cargar tipo, talla y cantidad.
          </p>
        ) : (
          <>
            <ul className="mt-3 space-y-3 md:hidden">
              {(skus ?? []).map((s) => {
                const dept = Array.isArray(s.departments)
                  ? s.departments[0]
                  : s.departments;
                return (
                  <li
                    key={s.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <p className="font-medium">{s.name}</p>
                    <p className="font-mono text-xs text-zinc-500">
                      {s.code} · talla {s.size}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                      <div>
                        <dt className="text-xs text-zinc-500">Fijos</dt>
                        <dd className="tabular-nums">{skuGroups.get(s.id)?.fijo ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">Eventuales</dt>
                        <dd className="tabular-nums">{skuGroups.get(s.id)?.eventual ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">RR.HH.</dt>
                        <dd className="tabular-nums font-medium">{Number(s.available)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">No utilizables</dt>
                        <dd className="tabular-nums">{Number(s.unusable)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">Total</dt>
                        <dd className="tabular-nums">{Number(s.total)}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-zinc-500">
                      {dept?.name ?? "Sin depto."}
                    </p>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Código</th>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Talla</th>
                    <th className="px-4 py-3 font-medium">Depto.</th>
                    <th className="px-4 py-3 font-medium">Fijos</th>
                    <th className="px-4 py-3 font-medium">Eventuales</th>
                    <th className="px-4 py-3 font-medium">RR.HH.</th>
                    <th className="px-4 py-3 font-medium">No utilizables</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(skus ?? []).map((s) => {
                    const dept = Array.isArray(s.departments)
                      ? s.departments[0]
                      : s.departments;
                    return (
                      <tr key={s.id} className="border-t border-zinc-100">
                        <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3">{s.size}</td>
                        <td className="px-4 py-3 text-zinc-600">
                          {dept?.code ?? "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {skuGroups.get(s.id)?.fijo ?? 0}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {skuGroups.get(s.id)?.eventual ?? 0}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {Number(s.available)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {Number(s.unusable)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {Number(s.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Asignaciones abiertas</h2>
        {openAssignments.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Sin asignaciones abiertas.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {openAssignments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-medium">{a.worker_name}</p>
                  {a.worker_code ? (
                    <p className="font-mono text-xs text-zinc-500">
                      Código {a.worker_code}
                    </p>
                  ) : null}
                  <p className="text-sm text-zinc-600">
                    {a.uniform_skus
                      ? `${a.uniform_skus.code} · ${a.uniform_skus.name} (${a.uniform_skus.size})`
                      : "—"}{" "}
                    × {a.quantity}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDateTime(a.assigned_at)}
                  </p>
                </div>
                {canAssign ? (
                  <div className="flex flex-wrap gap-2">
                    <ReturnUniformButton assignment={a} />
                    {canManage ? (
                      <MarkAssignmentUnusableButton assignment={a} />
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
