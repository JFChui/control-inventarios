import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessModule, type ModuleKey } from "@/lib/auth/modules";
import { canManageCatalog } from "@/lib/auth/roles";
import { requireModule } from "@/lib/auth/session";
import { hotelToday } from "@/lib/format/datetime";
import { createClient } from "@/lib/supabase/server";

const modules: {
  href: string;
  title: string;
  desc: string;
  module: ModuleKey;
  tone: string;
}[] = [
  {
    href: "/inventario",
    title: "Inventario general",
    desc: "Catálogo, existencias y kardex por producto",
    module: "inventario",
    tone: "bg-teal-800 text-white",
  },
  {
    href: "/movimientos",
    title: "Entradas y salidas",
    desc: "Registrar movimientos que actualizan el stock",
    module: "movimientos",
    tone: "bg-white text-zinc-900 border border-zinc-200",
  },
  {
    href: "/inventario/linner-recepcion",
    title: "Linner de recepción",
    desc: "Mínimo, máximo y existencia de ese linner",
    module: "linner_recepcion",
    tone: "bg-white text-zinc-900 border border-zinc-200",
  },
  {
    href: "/blancos",
    title: "Control de blancos",
    desc: "Disponible, en uso, lavandería, dañado y baja",
    module: "blancos",
    tone: "bg-white text-zinc-900 border border-zinc-200",
  },
  {
    href: "/inventario-fisico",
    title: "Inventario físico",
    desc: "Conteo real vs sistema y ajustes",
    module: "inventario_fisico",
    tone: "bg-white text-zinc-900 border border-zinc-200",
  },
  {
    href: "/dotacion",
    title: "Dotación camarera",
    desc: "Habitaciones por estatus → consumos calculados",
    module: "dotacion",
    tone: "bg-white text-zinc-900 border border-zinc-200",
  },
  {
    href: "/uniformes",
    title: "Uniformes",
    desc: "Asignación y devolución por trabajador",
    module: "uniformes",
    tone: "bg-white text-zinc-900 border border-zinc-200",
  },
  {
    href: "/maquinaria",
    title: "Maquinaria",
    desc: "Reportes de falla y mantenimiento",
    module: "maquinaria",
    tone: "bg-white text-zinc-900 border border-zinc-200",
  },
  {
    href: "/reportes",
    title: "Reportes",
    desc: "Inventario, consumo por depto y alertas",
    module: "reportes",
    tone: "bg-white text-zinc-900 border border-zinc-200",
  },
  {
    href: "/estadisticas",
    title: "Estadísticas",
    desc: "Ocupación hotelera vs consumo real",
    module: "estadisticas",
    tone: "bg-white text-zinc-900 border border-zinc-200",
  },
  {
    href: "/alertas",
    title: "Alertas",
    desc: "Productos bajo o en stock mínimo",
    module: "alertas",
    tone: "bg-white text-zinc-900 border border-zinc-200",
  },
];

export default async function DashboardPage() {
  const { profile } = await requireModule("dashboard");
  const supabase = await createClient();
  const role = profile.role;

  const now = new Date();
  const today = hotelToday(now);

  const loadProducts = canAccessModule(role, "inventario");
  const loadAlerts = canAccessModule(role, "alertas");
  const loadMovements = canAccessModule(role, "movimientos") || canAccessModule(role, "inventario");
  const loadMachines = canAccessModule(role, "maquinaria");
  const loadOccupancy = canAccessModule(role, "estadisticas");

  const [
    { count: productsCount } = { count: 0 },
    { count: activeCount } = { count: 0 },
    { count: lowStockCount } = { count: 0 },
    { count: movementsCount } = { count: 0 },
    { count: openTickets } = { count: 0 },
    { data: occupancy } = { data: null },
    { data: recentOuts } = { data: null },
  ] = await Promise.all([
    loadProducts
      ? supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
      : Promise.resolve({ count: 0 }),
    loadProducts
      ? supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .gt("quantity_on_hand", 0)
      : Promise.resolve({ count: 0 }),
    loadAlerts
      ? supabase
          .from("v_products_low_stock")
          .select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0 }),
    loadMovements
      ? supabase.from("stock_movements").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0 }),
    loadMachines
      ? supabase
          .from("machine_tickets")
          .select("*", { count: "exact", head: true })
          .not("status", "in", "(reparada,fuera_de_servicio)")
      : Promise.resolve({ count: 0 }),
    loadOccupancy
      ? supabase
          .from("daily_occupancy")
          .select("occupancy_pct")
          .eq("occupancy_date", today)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadMovements
      ? supabase
          .from("stock_movements")
          .select("quantity, product_id, products(id, code, name)")
          .eq("movement_type", "out")
          .gte(
            "occurred_at",
            new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          )
      : Promise.resolve({ data: [] }),
  ]);

  const cards = [
    loadProducts
      ? {
          label: "Productos",
          value: productsCount ?? 0,
          href: "/inventario",
          hint: "activos",
          module: "inventario" as const,
          alert: false,
        }
      : null,
    loadProducts
      ? {
          label: "Con existencia",
          value: activeCount ?? 0,
          href: "/inventario",
          hint: "activos con stock",
          module: "inventario" as const,
          alert: false,
        }
      : null,
    loadAlerts
      ? {
          label: "Bajo stock",
          value: lowStockCount ?? 0,
          href: "/alertas",
          hint: "requieren reposición",
          module: "alertas" as const,
          alert: (lowStockCount ?? 0) > 0,
        }
      : null,
    loadMovements
      ? {
          label: "Movimientos",
          value: movementsCount ?? 0,
          href: canAccessModule(role, "movimientos") ? "/movimientos" : "/inventario",
          hint: "en kardex",
          module: "inventario" as const,
          alert: false,
        }
      : null,
    loadMachines
      ? {
          label: "Maquinaria",
          value: openTickets ?? 0,
          href: "/maquinaria",
          hint: "tickets abiertos",
          module: "maquinaria" as const,
          alert: (openTickets ?? 0) > 0,
        }
      : null,
    loadOccupancy
      ? {
          label: "Ocupación",
          value:
            occupancy?.occupancy_pct != null
              ? `${Number(occupancy.occupancy_pct)}%`
              : "—",
          href: "/estadisticas",
          hint: "hoy",
          module: "estadisticas" as const,
          alert: false,
        }
      : null,
  ].filter((card) => card !== null);

  const consumption = new Map<
    string,
    { id: string; code: string; name: string; qty: number }
  >();
  for (const movement of recentOuts ?? []) {
    const product = Array.isArray(movement.products)
      ? movement.products[0]
      : movement.products;
    if (!product) continue;
    const prev = consumption.get(product.id) ?? {
      id: product.id,
      code: product.code,
      name: product.name,
      qty: 0,
    };
    prev.qty += Number(movement.quantity);
    consumption.set(product.id, prev);
  }
  const topOuts = Array.from(consumption.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const visibleModules = modules.filter((mod) =>
    canAccessModule(role, mod.module),
  );

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-zinc-900 px-5 py-6 text-white shadow-lg print:hidden sm:px-8 sm:py-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-teal-200 uppercase">
          Hotel Demo
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Panel de inventarios
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-teal-50/90 sm:text-base">
          Ama de Llaves y Lavandería — stock único, kardex y módulos operativos
          en un solo sistema.
        </p>
        {canManageCatalog(role) ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/inventario/nuevo"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50"
            >
              Nuevo producto
            </Link>
          </div>
        ) : null}
      </section>

      <PageHeader title="Dashboard" description="Resumen en vivo del inventario y la operación" />

      {cards.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Indicadores</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className={`rounded-xl border p-4 shadow-sm transition hover:border-teal-700/50 ${
                  card.alert
                    ? "border-amber-300 bg-amber-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <p className="text-xs font-medium text-zinc-500 sm:text-sm">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{card.hint}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {loadMovements ? (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Salidas recientes
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Consumo real de los últimos 7 días
              </p>
            </div>
          </div>
          {topOuts.length === 0 ? (
            <p className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
              No hay salidas registradas en los últimos 7 días.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              {topOuts.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/inventario/${item.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-zinc-50"
                  >
                    <span>
                      <span className="font-mono text-xs text-zinc-500">
                        {item.code}
                      </span>{" "}
                      {item.name}
                    </span>
                    <span className="tabular-nums font-medium">{item.qty}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          Módulos del sistema
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Accesos según tu cargo
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className={`group rounded-xl p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${mod.tone}`}
            >
              <p className="text-base font-semibold">{mod.title}</p>
              <p
                className={`mt-1 text-sm leading-snug ${
                  mod.tone.includes("bg-teal")
                    ? "text-teal-50/90"
                    : "text-zinc-600"
                }`}
              >
                {mod.desc}
              </p>
              <p
                className={`mt-3 text-xs font-medium ${
                  mod.tone.includes("bg-teal")
                    ? "text-teal-100"
                    : "text-teal-800"
                }`}
              >
                Abrir →
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
