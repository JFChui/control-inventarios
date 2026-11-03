import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/auth/modules";
import type { AppRole } from "@/lib/auth/roles";

export function RoleSelect({
  id,
  name = "role",
  defaultValue,
}: {
  id?: string;
  name?: string;
  defaultValue?: AppRole | string;
}) {
  const selected =
    defaultValue && ASSIGNABLE_ROLES.includes(defaultValue as (typeof ASSIGNABLE_ROLES)[number])
      ? defaultValue
      : "floor_supervisor_a";

  return (
    <select
      id={id}
      name={name}
      defaultValue={selected}
      className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
    >
      {ASSIGNABLE_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}
