"use client";

import { useMemo } from "react";
import { Box, Weight, Scale, ArrowRight, Sparkles } from "lucide-react";

interface VolumetricBox3DProps {
  length: number;
  width: number;
  height: number;
  actualWeight?: number;
  divisor?: number;
  className?: string;
}

export default function VolumetricBox3D({
  length = 30,
  width = 20,
  height = 15,
  actualWeight = 2,
  divisor = 5000,
  className = "",
}: VolumetricBox3DProps) {
  const safeL = Math.max(1, Number(length) || 1);
  const safeW = Math.max(1, Number(width) || 1);
  const safeH = Math.max(1, Number(height) || 1);
  const safeActual = Math.max(0, Number(actualWeight) || 0);

  // Volumetric calculation (L x W x H / 5000)
  const volWeight = useMemo(() => {
    return Number(((safeL * safeW * safeH) / divisor).toFixed(2));
  }, [safeL, safeW, safeH, divisor]);

  const chargeableWeight = Math.max(safeActual, volWeight);
  const isVolumetricHigher = volWeight > safeActual;

  // Compute isometric 3D box coordinates normalized to bounding box
  const maxDim = Math.max(safeL, safeW, safeH, 1);
  const scale = 110 / maxDim;

  const isoL = Math.max(25, Math.min(130, safeL * scale)); // Length along X-axis
  const isoW = Math.max(25, Math.min(130, safeW * scale)); // Width along Z-axis
  const isoH = Math.max(20, Math.min(120, safeH * scale)); // Height along Y-axis

  // Center anchor point in SVG (viewBox 0 0 320 240)
  const cx = 160;
  const cy = 135;

  // Isometric angle projection constants (30 degrees)
  const cos30 = 0.866;
  const sin30 = 0.5;

  // Front bottom corner (origin)
  const p0 = { x: cx, y: cy };
  // Left bottom corner
  const p1 = { x: cx - isoL * cos30, y: cy + isoL * sin30 };
  // Right bottom corner
  const p2 = { x: cx + isoW * cos30, y: cy + isoW * sin30 };
  // Back bottom corner
  const p3 = { x: cx + (isoW - isoL) * cos30, y: cy + (isoL + isoW) * sin30 };

  // Front top corner
  const pt0 = { x: p0.x, y: p0.y - isoH };
  // Left top corner
  const pt1 = { x: p1.x, y: p1.y - isoH };
  // Right top corner
  const pt2 = { x: p2.x, y: p2.y - isoH };
  // Back top corner
  const pt3 = { x: p3.x, y: p3.y - isoH };

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-zinc-800 bg-linear-to-b from-slate-50/80 to-white dark:from-zinc-900/90 dark:to-zinc-950 p-5 shadow-xs transition-all duration-300 ${className}`}
    >
      {/* Title & Dimension Summary */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Box className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
            3D Volumetric Package Preview
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
          {safeL} × {safeW} × {safeH} cm
        </div>
      </div>

      {/* 3D Box Rendering Stage */}
      <div className="relative flex items-center justify-center py-4 select-none">
        <svg
          viewBox="0 0 320 220"
          className="w-full max-w-[280px] h-auto drop-shadow-lg transition-all duration-300 ease-out"
        >
          <defs>
            {/* Gradients for box faces */}
            <linearGradient id="topFace" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="leftFace" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id="rightFace" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
            {/* Box shadow on the floor */}
            <radialGradient id="boxShadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.25)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>

          {/* Floor Shadow */}
          <ellipse
            cx={cx + (isoW - isoL) * 0.25}
            cy={cy + (isoL + isoW) * 0.25 + 5}
            rx={Math.max(40, (isoL + isoW) * 0.65)}
            ry={Math.max(15, (isoL + isoW) * 0.25)}
            fill="url(#boxShadow)"
          />

          {/* Left Face */}
          <polygon
            points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${pt1.x},${pt1.y} ${pt0.x},${pt0.y}`}
            fill="url(#leftFace)"
            stroke="#92400e"
            strokeWidth="1"
          />

          {/* Right Face */}
          <polygon
            points={`${p0.x},${p0.y} ${p2.x},${p2.y} ${pt2.x},${pt2.y} ${pt0.x},${pt0.y}`}
            fill="url(#rightFace)"
            stroke="#78350f"
            strokeWidth="1"
          />

          {/* Top Face */}
          <polygon
            points={`${pt0.x},${pt0.y} ${pt1.x},${pt1.y} ${pt3.x},${pt3.y} ${pt2.x},${pt2.y}`}
            fill="url(#topFace)"
            stroke="#b45309"
            strokeWidth="1"
          />

          {/* Center Seam / Tape Line across top face */}
          <line
            x1={(pt1.x + pt0.x) / 2}
            y1={(pt1.y + pt0.y) / 2}
            x2={(pt3.x + pt2.x) / 2}
            y2={(pt3.y + pt2.y) / 2}
            stroke="#78350f"
            strokeWidth="3"
            strokeDasharray="4 2"
            opacity="0.8"
          />

          {/* Dimension Labels Callouts */}
          {/* Height (H) */}
          <text
            x={p1.x - 12}
            y={(p1.y + pt1.y) / 2}
            fill="#64748b"
            fontSize="10"
            fontWeight="bold"
            textAnchor="end"
            className="dark:fill-zinc-400"
          >
            H: {safeH}cm
          </text>

          {/* Length (L) */}
          <text
            x={(p0.x + p1.x) / 2 - 8}
            y={(p0.y + p1.y) / 2 + 16}
            fill="#64748b"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
            className="dark:fill-zinc-400"
          >
            L: {safeL}cm
          </text>

          {/* Width (W) */}
          <text
            x={(p0.x + p2.x) / 2 + 10}
            y={(p0.y + p2.y) / 2 + 16}
            fill="#64748b"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
            className="dark:fill-zinc-400"
          >
            W: {safeW}cm
          </text>
        </svg>
      </div>

      {/* Metrics & Chargeable Weight Comparison */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800/80 text-xs">
        {/* Actual Weight */}
        <div
          className={`p-2.5 rounded-xl border transition-all ${
            !isVolumetricHigher
              ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60"
              : "bg-slate-50 dark:bg-zinc-850/60 border-slate-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-medium flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              Actual Wt.
            </span>
            {!isVolumetricHigher && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                Billed
              </span>
            )}
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {safeActual}{" "}
            <span className="text-[11px] font-normal text-slate-400">kg</span>
          </div>
        </div>

        {/* Volumetric Weight */}
        <div
          className={`p-2.5 rounded-xl border transition-all ${
            isVolumetricHigher
              ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60"
              : "bg-slate-50 dark:bg-zinc-850/60 border-slate-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-medium flex items-center gap-1">
              <Weight className="w-3.5 h-3.5 text-slate-400" />
              Volumetric Wt.
            </span>
            {isVolumetricHigher && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-600 text-white">
                Billed
              </span>
            )}
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-zinc-100">
            {volWeight}{" "}
            <span className="text-[11px] font-normal text-slate-400">kg</span>
          </div>
        </div>
      </div>

      {/* Chargeable Weight Callout Pill */}
      <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs">
        <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Chargeable Weight:</span>
        </div>
        <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300 font-mono">
          {chargeableWeight} kg
        </div>
      </div>
    </div>
  );
}
