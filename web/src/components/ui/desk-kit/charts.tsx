"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { cn } from "@/lib/utils";

/**
 * The desk kit's small charts (S22, D-127), from 21st: Traffic Source Donut (#29204, redrawn in SVG so the page carries
 * no chart library for it), Partition Bar (#26545), Progress radial (#3424), Mini Chart (#9613, as a line) and Avatar
 * Stack (#28355, with the registry's own company marks instead of photos).
 */

export interface Slice {
  id: string;
  label: string;
  /** Any unit; slices are drawn as shares of the sum. */
  value: number;
  color: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/** A ring of slices with a figure in the middle; the arcs draw in on mount and glide when a value changes. */
export function Donut({ slices, size = 160, thickness = 16, children, label }: { slices: readonly Slice[]; size?: number; thickness?: number; children?: ReactNode; label: string }) {
  const reduce = useReducedMotion();
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="dkit-donut" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-hairline)" strokeWidth={thickness} />
        {total > 0 &&
          slices.map((s) => {
            const len = (Math.max(0, s.value) / total) * c;
            const dash = Math.max(0, len - gap);
            const start = offset;
            offset += len;
            return (
              <motion.circle
                key={s.id}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeLinecap="butt"
                initial={reduce ? false : { strokeDasharray: `0 ${c}`, strokeDashoffset: -start }}
                animate={{ strokeDasharray: `${dash} ${c - dash}`, strokeDashoffset: -start }}
                transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
              />
            );
          })}
      </svg>
      {children && <div className="dkit-donut-center">{children}</div>}
    </div>
  );
}

/** One bar split into slices, each growing to its share; an optional target tick row sits under it. */
export function PartitionBar({ slices, height = 12, warn = false, label }: { slices: readonly Slice[]; height?: number; warn?: boolean; label: string }) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <div className="dkit-partition" data-warn={warn ? "" : undefined} style={{ height }} role="img" aria-label={label}>
      {total > 0 &&
        slices
          .filter((s) => s.value > 0)
          .map((s) => (
            <motion.span key={s.id} layout className="dkit-partition-seg" style={{ background: s.color }} animate={{ flexGrow: s.value / total }} initial={false} transition={{ duration: 0.35, ease: EASE }} title={s.label} />
          ))}
    </div>
  );
}

/** A circular gauge, 0–100, tinted by how close it is to full. */
export function RadialGauge({ value, size = 64, stroke = 6, tone, children, label }: { value: number; size?: number; stroke?: number; tone?: "accent" | "warn" | "loss" | "profit"; children?: ReactNode; label: string }) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="dkit-gauge" data-tone={tone ?? (clamped >= 90 ? "loss" : clamped >= 70 ? "warn" : "accent")} style={{ width: size, height: size }} role="meter" aria-label={label} aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-hairline)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={reduce ? false : { strokeDashoffset: c }} animate={{ strokeDashoffset: c - (clamped / 100) * c }} transition={{ duration: reduce ? 0 : 0.8, ease: EASE }} />
      </svg>
      {children && <div className="dkit-gauge-center">{children}</div>}
    </div>
  );
}

/** A tiny line with a soft fill, drawn left to right; flat input draws a flat line, one point draws nothing. */
export function Sparkline({ values, width = 96, height = 28, tone, className }: { values: readonly number[]; width?: number; height?: number; tone?: "up" | "down" | "flat"; className?: string }) {
  const reduce = useReducedMotion();
  if (values.length < 2) return <span className={cn("dkit-spark dkit-spark-empty", className)} style={{ width, height }} aria-hidden />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const t = tone ?? ((values.at(-1) ?? 0) > (values[0] ?? 0) ? "up" : (values.at(-1) ?? 0) < (values[0] ?? 0) ? "down" : "flat");
  return (
    <svg className={cn("dkit-spark", className)} data-tone={t} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={area} className="dkit-spark-area" />
      <motion.path d={line} className="dkit-spark-line" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.9, ease: EASE }} />
    </svg>
  );
}

/** Overlapping company marks with a "+N" cell; the names are for the screen reader and the hover. */
export function LogoStack({ symbols, max = 4, size = "md", names }: { symbols: readonly string[]; max?: number; size?: "sm" | "md" | "lg"; names?: readonly string[] }) {
  const shown = symbols.slice(0, max);
  const more = symbols.length - shown.length;
  return (
    <span className="dkit-logos" data-size={size} role="img" aria-label={(names ?? symbols).join(", ")}>
      {shown.map((s, i) => (
        <span key={s} className="dkit-logo" style={{ zIndex: shown.length - i }} title={names?.[i] ?? s}>
          <AssetDisc asset={s} className="dkit-logo-disc" />
        </span>
      ))}
      {more > 0 && <span className="dkit-logo dkit-logo-more">+{more}</span>}
    </span>
  );
}
