# Control de Inventarios

Sistema web de inventario para Ama de Llaves y Lavandería de un hotel. Un solo stock compartido entre módulos: kardex, blancos y linners, linner de recepción, conteo físico, dotación por camarera, uniformes, maquinaria, alertas, reportes y ocupación vs consumo.

Este repositorio es una copia de portafolio. La marca, los correos, las URLs y el padrón de personal están anonimizados. No incluye secretos de producción.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase · Vercel

Requiere **Node 24**. Proxy de sesión: `src/proxy.ts` (no `middleware.ts`).

## Empezar

```bash
npm install
npm run dev
npm test
```

Abre [http://localhost:3000](http://localhost:3000).

Copia `.env.example` → `.env.local` y rellena las claves de tu proyecto Supabase.

### Módulos

- `/` Dashboard
- `/inventario` · `/inventario/[id]` Kardex
- `/movimientos` Entradas y salidas (destino opcional: Linner de Recepción)
- `/inventario/linner-recepcion` Stock, mín/máx y consumo del linner de recepción
- `/blancos` Control de blancos (vueltas para 212 hab.)
- `/blancos/linners` Par y existencia por linner de piso (`L06`–`L26` sin `L13`) y `REC`
- `/inventario-fisico` Conteo vs sistema
- `/alertas` Bajo stock
- `/reportes` Inventario, bajo stock, maquinaria, blancos, uniformes, dotación, linner recepción
- `/uniformes` Fijos / eventuales / RR.HH. / no utilizables
- `/dotacion` Amenidades por camarera (rectificar confirmada)
- `/maquinaria` Máquinas de lavandería y equipos de habitación
- `/estadisticas` Ocupación vs consumo
- `/categorias` · `/departamentos` · `/usuarios` (Gerentes de Diseño y Estilo)
- `/inventario/minimos` Mínimo y unidad por categoría (Gerentes de Diseño y Estilo)

El menú se filtra por cargo: gerentes ven todo; RR.HH. uniformes; lavandería blancos/uniformes/maquinaria; piso inventario, conteo, alertas, reportes, dotación y linner de recepción.

## Variables de entorno

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (servidor: alta de usuarios, restablecer clave, keep-alive)

Migraciones versionadas en `supabase/migrations/`. En el proyecto original se aplicaron con Supabase MCP `apply_migration`. No usar `supabase db push` a ciegas.

## Documentación

Índice: [`docs/README.md`](docs/README.md)

- Spec de producto: [`docs/product-spec.md`](docs/product-spec.md)
- Manual de piso: [`docs/manual-usuario.md`](docs/manual-usuario.md)
- Plantilla de cuentas: [`docs/cuentas-de-acceso.md`](docs/cuentas-de-acceso.md)
- Sistemas / IT: [`docs/manual-sistemas.md`](docs/manual-sistemas.md)
- Lecciones: [`docs/lessons-learned.md`](docs/lessons-learned.md)

## Cómo se usó la IA en este proyecto

El desarrollo se hizo en Cursor. El contexto de dominio y de ops viaja con el repo, no en un “custom agent” suelto.

| Recurso | Uso |
|---------|-----|
| [`.cursor/rules/product-domain.mdc`](.cursor/rules/product-domain.mdc) | Reglas de negocio siempre activas |
| [`.cursor/rules/stack.mdc`](.cursor/rules/stack.mdc) | Stack Next.js + Supabase + Vercel |
| [`.cursor/rules/ship-on-change.mdc`](.cursor/rules/ship-on-change.mdc) | Commit + push + deploy después de cada cambio real |
| [`.cursor/skills/hotel-inventory-domain/`](.cursor/skills/hotel-inventory-domain/) | Cómo implementar módulos de inventario |
| [`.cursor/skills/project-lessons/`](.cursor/skills/project-lessons/) | Auth, RLS, MCP, deploy, pitfalls |
| [`.cursor/mcp.json`](.cursor/mcp.json) | Supabase MCP para SQL y migraciones remotas |
| [`docs/lessons-learned.md`](docs/lessons-learned.md) | Errores ya cometidos (RLS recursivo, env, UTC, proxy) |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | Roadmap de maduración por fases |
| [`AGENTS.md`](AGENTS.md) | Guía Next.js para agentes |
| [`skills-lock.json`](skills-lock.json) | Skills instaladas |

Lecciones que más importaron: RLS con helpers `SECURITY DEFINER` para no recursar `profiles`; no editar `quantity_on_hand` a mano (solo kardex); fechas en `America/Caracas`; `src/proxy.ts` en lugar de `middleware.ts`; el historial de migraciones de MCP debe coincidir con los archivos locales.

## Pipeline

- Ejemplo CI/CD: [`docs/pipeline-ejemplo.md`](docs/pipeline-ejemplo.md)
- GitHub Actions: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
