import {
  DepartmentCreateForm,
  DepartmentEditForm,
} from "@/components/departments/department-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function DepartamentosPage() {
  await requireModule("departamentos");

  const supabase = await createClient();
  const { data: departments } = await supabase
    .from("departments")
    .select("id, code, name, is_active, created_at")
    .order("code");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departamentos"
        description="Los gerentes de Diseño y Estilo pueden crear, editar o desactivar departamentos."
      />

      <DepartmentCreateForm />

      <ul className="space-y-4">
        {(departments ?? []).map((department) => (
          <li
            key={department.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-zinc-900">{department.name}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  department.is_active
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {department.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <DepartmentEditForm department={department} />
          </li>
        ))}
      </ul>
    </div>
  );
}
