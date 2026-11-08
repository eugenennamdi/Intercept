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
 * shadcn/ui Monochrome Area & Threshold Chart
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

  const minY = 0.78;
  const maxY = 1.55;

  const toX = (i: number) =>
    padLeft + (points.length <= 1 ? 0 : (i / (points.length - 1)) * plotW);
  const toY = (hf: number) => {
    const clamped = Math.max(minY, Math.min(maxY, hf));
    return padTop + (1 - (clamped - minY) / (maxY - minY)) * plotH;
  };

  const buildPath = (selector: (p: TrajectoryPoint) => number) =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(selector(p)).toFixed(1)}`)
      .join(" ");

  const interceptPath = buildPath((p) => p.interceptHf);
  const unprotectedPath = buildPath((p) => p.unprotectedHf);
  const naivePath = buildPath((p) => p.naiveHf);

  const interceptArea = `${interceptPath} L${toX(points.length - 1).toFixed(1)},${(
    padTop + plotH
  ).toFixed(1)} L${toX(0).toFixed(1)},${(padTop + plotH).toFixed(1)} Z`;

  const liqY = toY(1.0);
  const trigY = toY(triggerHf);
  const activePoint = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];

  return (
    <div className={cn("space-y-3", className)}>
      {/* shadcn/ui Chart Legend & Live Readout Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5 text-zinc-100 font-medium">
            <span className="h-2 w-2 rounded-[2px] bg-zinc-50" />
            <span>Intercept TEE</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-zinc-400">
            <span className="h-0.5 w-3 bg-zinc-400" />
            <span>Static 1.20x</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-zinc-500">
            <span className="h-0.5 w-3 border-b border-dashed border-zinc-500" />
            <span>Unprotected</span>
          </span>
        </div>

        {activePoint && (
          <div className="flex items-center gap-2.5 rounded-md border border-border bg-secondary/60 px-2.5 py-1 font-mono text-[11px] tabular-nums">
            <span className="text-zinc-400">{activePoint.tickLabel}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-300">${activePoint.solPriceUsd.toFixed(2)}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-50 font-semibold">
              HF {activePoint.interceptHf.toFixed(2)}
            </span>
            <span className="text-zinc-500">
              (Raw {activePoint.unprotectedHf.toFixed(2)})
            </span>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden rounded-lg border border-border/80 bg-[#09090b] p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[195px] select-none overflow-visible"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="shadcnMonoArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fafafa" stopOpacity="0.18" />
              <stop offset="85%" stopColor="#fafafa" stopOpacity="0.01" />
              <stop offset="100%" stopColor="#fafafa" stopOpacity="0.0" />
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
                  stroke="#1f1f23"
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
            stroke="#52525b"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Liquidation Cliff Reference Line (1.00) */}
          <line
            x1={padLeft}
            y1={liqY}
            x2={width - padRight}
            y2={liqY}
            stroke="#a1a1aa"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Area under Intercept curve */}
          <path d={interceptArea} fill="url(#shadcnMonoArea)" />

          {/* Unprotected Curve (Dashed Muted) */}
          <path
            d={unprotectedPath}
            fill="none"
            stroke="#52525b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Naive Static 1.20x Curve (Thin Zinc-400) */}
          <path
            d={naivePath}
            fill="none"
            stroke="#71717a"
            strokeWidth="1.5"
          />

          {/* Intercept Protected Curve (Crisp White 2px) */}
          <path
            d={interceptPath}
            fill="none"
            stroke="#fafafa"
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
                    stroke="#52525b"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                <circle
                  cx={cx}
                  cy={cyUnprotected}
                  r={isHovered ? 3.5 : 2}
                  fill="#09090b"
                  stroke="#71717a"
                  strokeWidth="1.5"
                />

                <circle
                  cx={cx}
                  cy={cyIntercept}
                  r={isHovered ? 4.5 : 2.75}
                  fill="#fafafa"
                  stroke="#09090b"
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
