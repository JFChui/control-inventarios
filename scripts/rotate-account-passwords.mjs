/**
 * Rota las claves de las cuentas @example.local y escribe
 * docs/cuentas-de-acceso.local.md (ignorado por git).
 *
 * Uso:
 *   node scripts/rotate-account-passwords.mjs --dry-run
 *   node scripts/rotate-account-passwords.mjs
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, ".env.local");
const LOCAL_ACCOUNTS = resolve(ROOT, "docs/cuentas-de-acceso.local.md");
const TEMP_PASSWORD_SUFFIX = "Aa1!";
const EMAIL_SUFFIX = "@example.local";

const ROLE_LABELS = {
  senior_design_manager: "Gerente Senior de Diseño y Estilo",
  design_manager: "Gerente de Diseño y Estilo",
  hr_manager: "Gerente de Recursos Humanos",
  laundry_supervisor: "Supervisor de lavandería",
  floor_supervisor_a: "Supervisor de piso A",
  floor_supervisor_b: "Supervisor de piso B",
  floor_supervisor_c: "Supervisor de piso C",
  mrla: "MRLA",
  admin: "Administrador (legado)",
  human_resources: "Recursos humanos (legado)",
  department_user: "Usuario de departamento (legado)",
};

function loadEnv(path) {
  const env = {};
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function generateTempPassword() {
  return randomUUID().replaceAll("-", "").slice(0, 12) + TEMP_PASSWORD_SUFFIX;
}

function roleLabel(role) {
  return ROLE_LABELS[role] ?? role ?? "—";
}

function departmentLabel(row) {
  const dept = Array.isArray(row.departments)
    ? row.departments[0]
    : row.departments;
  if (!dept) return "—";
  return dept.code ? `${dept.name} (${dept.code})` : dept.name ?? "—";
}

function renderLocalMarkdown(rows) {
  const when = new Date().toISOString();
  const table = [
    "| Quién / nombre | Correo | Contraseña temporal | Cargo | Departamento |",
    "|----------------|--------|---------------------|-------|--------------|",
    ...rows.map(
      (row) =>
        `| ${row.fullName} | \`${row.email}\` | \`${row.password}\` | ${row.roleLabel} | ${row.department} |`,
    ),
  ].join("\n");

  return `# Cuentas de acceso (local) — Hotel Demo

**Confidencial.** Este archivo **no** va a git. Generado el ${when} por \`scripts/rotate-account-passwords.mjs\`.

**Aplicación:** https://your-app.vercel.app/login

Cada persona debe cambiar esta clave al entrar. El administrador puede volver a restablecerla desde **Usuarios**.

---

${table}

No imprima esta hoja ni la deje en un escritorio compartido.
`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = loadEnv(ENV_PATH);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usersData, error: usersError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (usersError) throw usersError;

  const localUsers = (usersData.users ?? []).filter((user) =>
    String(user.email ?? "")
      .toLowerCase()
      .endsWith(EMAIL_SUFFIX),
  );
  if (localUsers.length === 0) {
    throw new Error(`No hay cuentas ${EMAIL_SUFFIX} en Auth.`);
  }

  const ids = localUsers.map((user) => user.id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, role, departments (code, name)")
    .in("id", ids);
  if (profilesError) throw profilesError;

  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  const rows = localUsers.map((user) => {
    const profile = profileById.get(user.id);
    return {
      id: user.id,
      email: user.email,
      fullName: profile?.full_name || user.email,
      roleLabel: roleLabel(profile?.role),
      department: departmentLabel(profile ?? {}),
      password: generateTempPassword(),
    };
  });

  if (dryRun) {
    process.stdout.write(
      `Dry-run: rotaría ${rows.length} cuentas ${EMAIL_SUFFIX}:\n`,
    );
    for (const row of rows) {
      process.stdout.write(`- ${row.email} (${row.roleLabel})\n`);
    }
    process.stdout.write("No se escribió el archivo local ni se cambió Auth.\n");
    return;
  }

  for (const row of rows) {
    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      row.id,
      { password: row.password },
    );
    if (passwordError) {
      throw new Error(`${row.email}: ${passwordError.message}`);
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (profileError) {
      throw new Error(`${row.email} (perfil): ${profileError.message}`);
    }
  }

  writeFileSync(LOCAL_ACCOUNTS, renderLocalMarkdown(rows), "utf8");
  process.stdout.write(
    `Rotadas ${rows.length} cuentas. Claves en docs/cuentas-de-acceso.local.md (no git).\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
