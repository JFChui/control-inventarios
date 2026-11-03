"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import {
  canAccessModule,
  roleLabel,
  type ModuleKey,
} from "@/lib/auth/modules";
import { canManageCatalog, type Profile } from "@/lib/auth/roles";
import { StockAlertBubble } from "@/components/layout/stock-alert-bubble";

type NavLink = {
  href: string;
  label: string;
  module: ModuleKey;
};

type NavGroup = {
  title: string;
  links: NavLink[];
};

const navGroups: NavGroup[] = [
  {
    title: "Inicio",
    links: [{ href: "/", label: "Dashboard", module: "dashboard" }],
  },
  {
    title: "Inventario",
    links: [
      { href: "/inventario", label: "Inventario general", module: "inventario" },
      { href: "/movimientos", label: "Entradas y salidas", module: "movimientos" },
      { href: "/alertas", label: "Alertas de stock", module: "alertas" },
      { href: "/categorias", label: "Categorías", module: "categorias" },
      {
        href: "/inventario/linner-recepcion",
        label: "Stock linner recepción",
        module: "linner_recepcion",
      },
    ],
  },
  {
    title: "Operación",
    links: [
      { href: "/blancos", label: "Control de blancos", module: "blancos" },
      { href: "/dotacion", label: "Dotación camarera", module: "dotacion" },
      {
        href: "/inventario-fisico",
        label: "Inventario físico",
        module: "inventario_fisico",
      },
    ],
  },
  {
    title: "Personal y equipos",
    links: [
      { href: "/uniformes", label: "Uniformes", module: "uniformes" },
      { href: "/maquinaria", label: "Maquinaria", module: "maquinaria" },
    ],
  },
  {
    title: "Análisis",
    links: [
      { href: "/reportes", label: "Reportes", module: "reportes" },
      { href: "/estadisticas", label: "Estadísticas", module: "estadisticas" },
    ],
  },
  {
    title: "Admin",
    links: [
      { href: "/departamentos", label: "Departamentos", module: "departamentos" },
      { href: "/usuarios", label: "Usuarios", module: "usuarios" },
    ],
  },
];

function NavLinks({
  role,
  onNavigate,
}: {
  role: Profile["role"] | null | undefined;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const manage = canManageCatalog(role);

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => {
        const visible = group.links.filter((link) =>
          canAccessModule(role, link.module),
        );
        if (visible.length === 0) return null;

        return (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.14em] text-teal-400/90 uppercase">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {visible.map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname === link.href ||
                      pathname.startsWith(`${link.href}/`);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-teal-800 font-medium text-white shadow-sm"
                        : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
      {manage ? (
        <Link
          href="/inventario/nuevo"
          onClick={onNavigate}
          className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            pathname === "/inventario/nuevo"
              ? "bg-teal-700 text-white"
              : "border border-teal-700/50 text-teal-300 hover:bg-zinc-900"
          }`}
        >
          + Nuevo producto
        </Link>
      ) : null}
    </nav>
  );
}

function SidebarPanel({
  profile,
  onNavigate,
  onClose,
}: {
  profile: Profile | null;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-teal-950/40 px-5 py-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wider text-teal-300 uppercase">
            Hotel Demo
          </p>
          <h1 className="mt-1 text-base font-semibold leading-snug text-white">
            Control de inventarios
          </h1>
          <p className="mt-1 text-[11px] text-zinc-400">
            Ama de Llaves · Lavandería
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-900 hover:text-white"
            aria-label="Cerrar menú"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      <NavLinks role={profile?.role} onNavigate={onNavigate} />

      <div className="border-t border-zinc-800 px-4 py-4 text-sm">
        <p className="font-medium text-white">
          {profile?.full_name ?? "Usuario"}
        </p>
        <p className="text-xs text-zinc-400">
          Cargo: {roleLabel(profile?.role)}
        </p>
        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="min-h-10 text-xs text-zinc-400 underline-offset-2 hover:text-white hover:underline"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </>
  );
}

export function AppShell({
  profile,
  children,
}: {
  profile: Profile | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState(pathname);
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex min-h-screen bg-[#f3f6f5] text-zinc-900">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100 print:hidden lg:flex">
        <SidebarPanel profile={profile} />
      </aside>

      <div
        className={`fixed inset-0 z-40 print:hidden lg:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/50 transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[min(19rem,90vw)] flex-col overflow-y-auto bg-zinc-950 text-zinc-100 shadow-xl transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarPanel
            profile={profile}
            onNavigate={() => setOpen(false)}
            onClose={() => setOpen(false)}
          />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-teal-900/10 bg-[#f3f6f5]/95 px-4 py-3 backdrop-blur print:hidden lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 shadow-sm"
            aria-label="Abrir menú"
            aria-expanded={open}
          >
            <MenuIcon />
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-wider text-teal-800 uppercase">
              Hotel Demo
            </p>
            <p className="truncate text-sm font-medium text-zinc-900">
              Control de inventarios
            </p>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 md:px-8 print:p-4">
          {children}
        </main>
      </div>

      {profile && canAccessModule(profile.role, "alertas") ? (
        <div className="print:hidden">
          <StockAlertBubble />
        </div>
      ) : null}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 5.5h14M3 10h14M3 14.5h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
