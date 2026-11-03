"use client";

import { createClient } from "@/lib/supabase/client";
import { STOCK_STATUS_UI, type StockStatus } from "@/lib/stock/status";
import { useEffect, useState } from "react";
import Link from "next/link";

type Low = {
  id: string;
  code: string;
  name: string;
  quantity_on_hand: number;
  min_stock: number;
  stock_status: string;
};

export function StockAlertBubble() {
  const [items, setItems] = useState<Low[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    function refresh() {
      void supabase
        .from("v_products_low_stock")
        .select("id, code, name, quantity_on_hand, min_stock, stock_status")
        .order("quantity_on_hand")
        .then(({ data }) => {
          if (!cancelled) setItems((data as Low[]) ?? []);
        });
    }

    refresh();
    const channel = supabase
      .channel("products-stock-alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          refresh();
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const count = items.length;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
      {open ? (
        <div
          id="stock-alert-panel"
          role="dialog"
          aria-label="Alertas de stock mínimo"
          className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Stock mínimo</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {count === 0
                  ? "Sin productos en alerta"
                  : `${count} producto${count === 1 ? "" : "s"} bajo mínimo`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              aria-label="Cerrar alertas"
            >
              ×
            </button>
          </div>

          {count === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-600">
              No hay productos en alerta de stock.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="border-t border-zinc-100 first:border-t-0">
                  <Link
                    href={`/inventario/${item.id}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-zinc-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {item.name}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-zinc-500">
                          {item.code}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {STOCK_STATUS_UI[item.stock_status as StockStatus]
                          ?.label ?? item.stock_status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      Existencia {Number(item.quantity_on_hand)} · Stock mínimo{" "}
                      {Number(item.min_stock)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-zinc-100 px-4 py-3">
            <Link
              href="/alertas"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-10 items-center text-sm font-medium text-teal-800 hover:underline"
            >
              Ver alertas
            </Link>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium shadow-lg ${
          count > 0
            ? "bg-amber-600 text-white hover:bg-amber-700"
            : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
        }`}
        aria-expanded={open}
        aria-controls="stock-alert-panel"
        aria-label={`Alertas de stock mínimo: ${count}`}
      >
        <span aria-hidden>{count > 0 ? "!" : "✓"}</span>
        <span className="tabular-nums">{count}</span>
      </button>
    </div>
  );
}
