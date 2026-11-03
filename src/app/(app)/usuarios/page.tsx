import { CreateUserForm } from "@/components/users/create-user-form";
import { ProfileEditForm } from "@/components/users/profile-edit-form";
import { PageHeader } from "@/components/ui/page-header";
import type { AppRole } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function UsuariosPage() {
  const { user } = await requireModule("usuarios");

  const supabase = await createClient();
  const [{ data: profiles }, { data: departments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, department_id, is_active")
      .order("full_name"),
    supabase.from("departments").select("id, code, name").order("code"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Crea usuarios con contraseña temporal y gestiona cargo, departamento y estado."
      />

      <CreateUserForm departments={departments ?? []} />

      <ul className="space-y-4">
        {(profiles ?? []).map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-500 font-mono">{p.id}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  p.is_active
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {p.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <ProfileEditForm
              profile={{
                id: p.id,
                full_name: p.full_name,
                role: p.role as AppRole,
                department_id: p.department_id,
                is_active: p.is_active,
              }}
              departments={departments ?? []}
              currentUserId={user.id}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
