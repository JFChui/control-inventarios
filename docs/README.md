# Documentación — Control de inventarios Hotel Demo

Elija el documento según quién lo necesita.

| Documento | Para quién | Qué contiene |
|-----------|------------|--------------|
| [Manual de usuario](manual-usuario.md) | Ama de Llaves, Lavandería, departamentos, RR.HH. | Cómo usar el sistema, **por cargo**. **Sin contraseñas.** |
| [Cuentas de acceso](cuentas-de-acceso.md) | Gerencia y Sistemas | Plantilla de roles y correos de ejemplo. **Sin claves.** |
| `docs/cuentas-de-acceso.local.md` | Solo Sistemas (máquina local) | Claves temporales. **No está en git.** |
| [Manual de sistemas](manual-sistemas.md) | Informática / soporte técnico | Arquitectura, base de datos, permisos, deploy, fallos frecuentes. |
| [Especificación de producto](product-spec.md) | Desarrollo y Ama de Llaves (reglas de negocio) | Qué debe hacer cada módulo. |
| [Esquema MVP](schema-mvp.md) | Desarrollo | Tablas, roles, RLS, vistas de stock. |
| [Esquema de módulos](schema-modules.md) | Desarrollo | Blancos, linners, linner recepción, conteo, uniformes, dotación, maquinaria, ocupación. |
| [Lecciones aprendidas](lessons-learned.md) | Desarrollo / ops | Errores ya cometidos (RLS, env, deploy, UTC, proxy). No repetir. |
| [Checklist RLS por cargo](qa/rls-cargos-checklist.md) | QA / desarrollo | Prueba vigente (`cargo_rls.sql`). |
| [Checklist RLS fase 1](qa/phase1-rls-checklist.md) | Histórico | Roles y solicitudes de agosto 2026. |

**Aplicación en producción:** https://your-app.vercel.app

Manual de piso: Markdown [`manual-usuario.md`](manual-usuario.md) y PDF [`manual-usuario.pdf`](manual-usuario.pdf).  
Cuentas (plantilla, sin claves): [`cuentas-de-acceso.md`](cuentas-de-acceso.md).  
Regenerar el PDF del manual: `python scripts/build-user-manual-pdf.py` (usa Microsoft Edge o Chrome).
