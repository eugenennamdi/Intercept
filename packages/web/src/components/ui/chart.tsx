"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TrajectoryPoint {
  tickLabel: string;
  solPriceUsd: number;
  unprotectedHf: number;
  interceptHf: number;
  naiveHf: number;
  annotation?: string;
}

/**
 * shadcn/ui Monochrome Light Area & Threshold Chart
 * Renders interactive multi-series Health Factor trajectory with crosshair & ChartTooltipContent
 */
export function HealthFactorTrajectoryChart({
  points,
  triggerHf = 1.15,
  className,
}: {
  points: TrajectoryPoint[];
  triggerHf?: number;
  className?: string;
}) {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  const width = 680;
  const height = 210;
  const padLeft = 42;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allValues = points.flatMap((p) => [
    p.unprotectedHf,
    p.interceptHf,
    p.naiveHf,
    triggerHf,
    1.0,
  ]);
  const minY = Math.min(
    0.78,
    Math.floor((Math.min(...allValues) - 0.05) * 20) / 20
  );
  const maxY = Math.max(
    1.55,
    Math.ceil((Math.max(...allValues) + 0.05) * 20) / 20
  );

  const toX = (i: number) =>
    padLeft + (points.length <= 1 ? 0 : (i / (points.length - 1)) * plotW);
  const toY = (hf: number) => {
    const clamped = Math.max(minY, Math.min(maxY, hf));
    return padTop + (1 - (clamped - minY) / (maxY - minY)) * plotH;
  };

  const buildPath = (selector: (p: TrajectoryPoint) => number) =>
    points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(selector(p)).toFixed(1)}`
      )
      .join(" ");

  const interceptPath = buildPath((p) => p.interceptHf);
  const unprotectedPath = buildPath((p) => p.unprotectedHf);
  const naivePath = buildPath((p) => p.naiveHf);

  const interceptArea = `${interceptPath} L${toX(points.length - 1).toFixed(1)},${(
    padTop + plotH
  ).toFixed(1)} L${toX(0).toFixed(1)},${(padTop + plotH).toFixed(1)} Z`;

  const liqY = toY(1.0);
  const trigY = toY(triggerHf);
  const activePoint =
    hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];

  return (
    <div className={cn("space-y-3", className)}>
      {/* shadcn/ui Chart Legend & Live Readout Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5 text-zinc-950 font-semibold">
            <span className="h-2 w-2 rounded-[2px] bg-zinc-950" />
            <span>Intercept TEE</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-zinc-600">
            <span className="h-0.5 w-3 bg-zinc-500" />
            <span>Static 1.20x</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-zinc-500">
            <span className="h-0.5 w-3 border-b border-dashed border-zinc-400" />
            <span>Unprotected</span>
          </span>
        </div>

        {activePoint && (
          <div className="flex items-center gap-2.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] tabular-nums">
            <span className="text-zinc-500">{activePoint.tickLabel}</span>
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-700">${activePoint.solPriceUsd.toFixed(2)}</span>
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-950 font-semibold">
              HF {activePoint.interceptHf.toFixed(2)}
            </span>
            <span className="text-zinc-500">
              (Raw {activePoint.unprotectedHf.toFixed(2)})
            </span>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-white p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[195px] select-none overflow-visible"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="shadcnMonoLightArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#09090b" stopOpacity="0.10" />
              <stop offset="85%" stopColor="#09090b" stopOpacity="0.01" />
              <stop offset="100%" stopColor="#09090b" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Y-Axis Gridlines */}
          {[1.45, 1.3, 1.15, 1.0, 0.85].map((yVal) => {
            const y = toY(yVal);
            return (
              <g key={yVal}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#f1f1f3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-500 font-mono text-[10px]"
                >
                  {yVal.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Trigger Threshold Reference Line (1.15) */}
          <line
            x1={padLeft}
            y1={trigY}
            x2={width - padRight}
            y2={trigY}
            stroke="#a1a1aa"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Liquidation Cliff Reference Line (1.00) */}
          <line
            x1={padLeft}
            y1={liqY}
            x2={width - padRight}
            y2={liqY}
            stroke="#52525b"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Area under Intercept curve */}
          <path d={interceptArea} fill="url(#shadcnMonoLightArea)" />

          {/* Unprotected Curve (Dashed Muted) */}
          <path
            d={unprotectedPath}
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Naive Static 1.20x Curve (Thin Zinc-500) */}
          <path
            d={naivePath}
            fill="none"
            stroke="#71717a"
            strokeWidth="1.5"
          />

          {/* Intercept Protected Curve (Crisp Ink Black 2.2px) */}
          <path
            d={interceptPath}
            fill="none"
            stroke="#09090b"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Hover Columns & Data Nodes */}
          {points.map((p, i) => {
            const cx = toX(i);
            const cyIntercept = toY(p.interceptHf);
            const cyUnprotected = toY(p.unprotectedHf);
            const isHovered = hoverIdx === i;
            const colWidth = plotW / Math.max(1, points.length - 1);

            return (
              <g key={p.tickLabel}>
                {isHovered && (
                  <line
                    x1={cx}
                    y1={padTop}
                    x2={cx}
                    y2={padTop + plotH}
                    stroke="#a1a1aa"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                <circle
                  cx={cx}
                  cy={cyUnprotected}
                  r={isHovered ? 3.5 : 2}
                  fill="#ffffff"
                  stroke="#a1a1aa"
                  strokeWidth="1.5"
                />

                <circle
                  cx={cx}
                  cy={cyIntercept}
                  r={isHovered ? 4.5 : 2.75}
                  fill="#09090b"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-zinc-500 font-mono text-[10px]"
                >
                  {p.tickLabel}
                </text>

                {/* Invisible Hit Rect for 1:1 Pointer Tracking */}
                <rect
                  x={cx - colWidth / 2}
                  y={padTop}
                  width={colWidth}
                  height={plotH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
