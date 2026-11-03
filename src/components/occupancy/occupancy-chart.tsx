"use client";

import { useId, useState } from "react";
import {
  OCCUPANCY_COLOR_STOPS,
  occupancyBarColor,
} from "@/lib/stats/occupancy";

const VIEW_W = 720;
const VIEW_H = 280;
const PAD = { top: 20, right: 12, bottom: 52, left: 40 };

type Bar = { key: string; label: string; pct: number; detail?: string };

export function OccupancyBarChart({
  title,
  bars,
  editableTitle,
}: {
  title: string;
  bars: Bar[];
  editableTitle?: boolean;
}) {
  const [chartTitle, setChartTitle] = useState(title);
  const clipId = useId();
  const yMax = Math.max(100, ...bars.map((b) => b.pct), 0);
  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = VIEW_H - PAD.top - PAD.bottom;
  const n = bars.length;
  const slot = n > 0 ? innerW / n : innerW;
  const gap = n > 20 ? Math.min(2, slot * 0.12) : Math.min(8, slot * 0.22);
  const barW = Math.max(3, slot - gap);
  const labelEvery = n > 16 ? Math.ceil(n / 10) : 1;
  const ticks = [0, 25, 50, 75, 100].filter((t) => t <= yMax);
  if (yMax > 100) ticks.push(Math.round(yMax));
  const hasValues = bars.some((b) => b.pct > 0);

  function yFor(pct: number) {
    return PAD.top + innerH - (Math.min(pct, yMax) / yMax) * innerH;
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
      {editableTitle ? (
        <input
          value={chartTitle}
          onChange={(e) => setChartTitle(e.target.value)}
          className="w-full border-b border-transparent text-lg font-semibold hover:border-zinc-200 focus:border-teal-700 focus:outline-none print:border-0"
          aria-label="Título de la gráfica mensual"
        />
      ) : (
        <h2 className="text-lg font-semibold">{chartTitle}</h2>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 print:text-zinc-800">
        {OCCUPANCY_COLOR_STOPS.map((stop) => (
          <li key={stop.min} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-3.5 rounded-sm"
              style={{ backgroundColor: stop.color }}
              aria-hidden
            />
            {stop.label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-3.5 rounded-sm"
            style={{ backgroundColor: "#d4d4d8" }}
            aria-hidden
          />
          Sin dato
        </li>
      </ul>

      {n === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Sin datos para graficar.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <svg
            role="img"
            aria-label={`${chartTitle}. ${hasValues ? `${n} barras de ocupación.` : "Sin ocupación registrada."}`}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="h-auto w-full min-h-[220px]"
            preserveAspectRatio="xMidYMid meet"
          >
            <title>{chartTitle}</title>
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={PAD.left}
                  y={PAD.top}
                  width={innerW}
                  height={innerH}
                  rx="4"
                />
              </clipPath>
            </defs>
            <rect
              x={PAD.left}
              y={PAD.top}
              width={innerW}
              height={innerH}
              fill="#f4f4f5"
              rx="4"
            />
            {ticks.map((tick) => {
              const y = yFor(tick);
              return (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + innerW}
                    y1={y}
                    y2={y}
                    stroke="#d4d4d8"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#52525b"
                    fontSize="10"
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}
            <g clipPath={`url(#${clipId})`}>
              {bars.map((bar, i) => {
                const x = PAD.left + i * slot + gap / 2;
                const valueH = (Math.min(bar.pct, yMax) / yMax) * innerH;
                const h = bar.pct > 0 ? Math.max(valueH, 4) : 0;
                const y = PAD.top + innerH - h;
                const fill = occupancyBarColor(bar.pct);
                return (
                  <g key={bar.key}>
                    {bar.pct <= 0 ? (
                      <line
                        x1={x + barW / 2}
                        x2={x + barW / 2}
                        y1={PAD.top + innerH - 6}
                        y2={PAD.top + innerH}
                        stroke="#a1a1aa"
                        strokeWidth="1"
                      />
                    ) : (
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        rx={Math.min(3, barW / 3)}
                        fill={fill}
                      >
                        <title>
                          {bar.detail ?? bar.label}: {bar.pct}%
                        </title>
                      </rect>
                    )}
                  </g>
                );
              })}
            </g>
            {bars.map((bar, i) => {
              const show =
                i === 0 || i === n - 1 || i % labelEvery === 0;
              if (!show) return null;
              const x = PAD.left + i * slot + slot / 2;
              return (
                <text
                  key={`label-${bar.key}`}
                  x={x}
                  y={VIEW_H - 16}
                  textAnchor="middle"
                  fill="#52525b"
                  fontSize={n > 20 ? 9 : 10}
                >
                  {bar.label}
                </text>
              );
            })}
            {n <= 16
              ? bars.map((bar, i) => {
                  if (bar.pct <= 0) return null;
                  const x = PAD.left + i * slot + slot / 2;
                  const h = Math.max(
                    (Math.min(bar.pct, yMax) / yMax) * innerH,
                    4,
                  );
                  const y = PAD.top + innerH - h;
                  return (
                    <text
                      key={`pct-${bar.key}`}
                      x={x}
                      y={y - 6}
                      textAnchor="middle"
                      fill="#3f3f46"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {Math.round(bar.pct)}%
                    </text>
                  );
                })
              : null}
          </svg>
          {!hasValues ? (
            <p className="mt-2 text-center text-sm text-zinc-500">
              Aún no hay ocupación registrada en este período.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
