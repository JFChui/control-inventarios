# Cuentas de acceso — plantilla

**Confidencial.** Este archivo es para gerencia y Sistemas. El [manual de usuario](manual-usuario.md) **no** lleva contraseñas.

Las **claves no se guardan en git**. La hoja con contraseñas temporales vive solo en la máquina de Sistemas: `docs/cuentas-de-acceso.local.md` (y su PDF, si se genera). Ese archivo está en `.gitignore`.

**Aplicación:** `https://your-app.vercel.app/login`

Cree cuentas con correos internos de su hotel. El menú cambia según el cargo, no según el correo.

---

## Roles de ejemplo

| Quién la usa | Correo de ejemplo | Cargo en el sistema | Departamento |
|--------------|-------------------|---------------------|--------------|
| Administración / Sistemas | `admin@example.local` | Gerente Senior de Diseño y Estilo | — |
| Ama de Llaves | `ama@example.local` | MRLA | Ama de Llaves |
| Recursos Humanos | `hr@example.local` | Gerente de Recursos Humanos | — |
| Estilo | `estilo@example.local` | Supervisor de piso | Estilo (EST) |
| Lencería | `lenceria@example.local` | Supervisor de piso | Lencería (LEN) |
| Lavandería | `lavanderia@example.local` | Supervisor de lavandería | Lavandería (LAV) |
| Suministro huésped | `suministro@example.local` | Supervisor de piso | Suministro huésped (SUM) |
| Mantenimiento | `mantenimiento@example.local` | Supervisor de piso | Mantenimiento (MTO) |

La cuenta de Lavandería ve **Blancos**, **Uniformes** y **Maquinaria**. Los supervisores de piso y **MRLA** ven inventario, conteo, alertas, reportes, dotación y **stock del linner de recepción**; **no** registran entradas/salidas manuales. Solo un gerente crea usuarios y restablece contraseñas.

Si alguien olvida la clave, no hay recuperación por correo: un gerente la restablece desde **Usuarios**.

---

## Qué puede hacer cada tipo de cuenta

| Cargo | En español | Puede |
|-------|------------|-------|
| `senior_design_manager` / `design_manager` | Gerente de Diseño y Estilo | Todo, incluida la creación de usuarios y el restablecer contraseña |
| `hr_manager` | Recursos Humanos | Dashboard y **uniformes** |
| `laundry_supervisor` | Supervisor de lavandería | Dashboard, blancos, uniformes y maquinaria |
| `floor_supervisor_a/b/c` | Supervisor de piso | Inventario, conteo físico, alertas, reportes, dotación y linner de recepción |
| `mrla` | MRLA | Igual que supervisor de piso |

Un usuario **inactivo** no entra. Si el sistema pide cambiar la contraseña al primer ingreso (o tras un restablecimiento), hay que hacerlo antes de usar el menú.

Los valores `admin`, `human_resources` y `department_user` quedan en la base por compatibilidad; la pantalla de Usuarios ya no los asigna.

---

## Cómo restablecer una clave (solo gerentes)

1. Entre con una cuenta de Gerente de Diseño y Estilo.
2. Menú **Usuarios**.
3. Abra el perfil de la persona (no el suyo).
4. Pulse **Restablecer contraseña** y confirme.
5. El sistema muestra una **contraseña temporal una sola vez**. Cópiela y désela a la persona.
6. Esa persona entra y el sistema la manda a **Cambiar contraseña**.

No hay “olvidé mi contraseña” por correo si usa cuentas `.local`. Un gerente no puede restablecer ni desactivar su propia cuenta.

Para generar un juego nuevo de claves temporales en bloque (Sistemas):

```bash
node scripts/rotate-account-passwords.mjs --dry-run
node scripts/rotate-account-passwords.mjs
```

Eso escribe `docs/cuentas-de-acceso.local.md`. Regenerar PDFs: `python scripts/build-user-manual-pdf.py`.
