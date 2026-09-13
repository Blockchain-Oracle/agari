"use client";

import { termBand, type TermPoint } from "@masayume/core/surface";
import type { MarketId } from "@masayume/core/types";
import { bpsToOddsCents, formatClock } from "@masayume/core/units";
import { cn } from "@/lib/utils";
import { SURFACE } from "./copy";

interface TermChartProps {
  points: readonly TermPoint[];
  focalId: MarketId | null;
  onPick: (marketId: MarketId) => void;
}

const W = 1000;
const H = 100;
const GRID_ROWS = 3;

/**
 * §04's curve — the reference's `drawIvLine` (ATM IV against days to expiry) with the venue's
 * figure on the y-axis: each live Window's UP price, mid where both sides rest. The x-axis is
 * categorical, one slot per Window ordered by close, because five cadences from 5m to 1d do not
 * share a readable linear axis and a log axis would put the arithmetic between the reader and the
 * book. Each point is a button: pick a Window and the sections above read it.
 */
export function TermChart({ points, focalId, onPick }: TermChartProps) {
  const copy = SURFACE.term;
  const band = termBand(points);
  const priced = points.filter((p) => p.implied !== null);

  if (points.length < 2 || !band) {
    return (
      <div className="sf-box sf-box--chart sf-box--short">
        <div className="sf-box-empty">{points.length < 2 ? copy.oneWindow : priced.length === 0 && points.some((p) => p.structure === null) ? copy.reading : copy.unpriced}</div>
      </div>
    );
  }

  const slot = (i: number) => ((i + 0.5) / points.length) * 100;
  const yPct = (bps: number) => (1 - (bps - band.minBps) / Math.max(1, band.maxBps - band.minBps)) * 100;
  const line = points
    .map((p, i) => (p.implied ? `${((slot(i) / 100) * W).toFixed(1)},${((yPct(p.implied.bps) / 100) * H).toFixed(1)}` : null))
    .filter((v): v is string => v !== null)
    .join(" ");
  const gridLabels = Array.from({ length: GRID_ROWS + 1 }, (_, i) => band.maxBps - (i / GRID_ROWS) * (band.maxBps - band.minBps));

  return (
    <div className="sf-box sf-box--chart sf-box--short sf-term">
      <div className="sf-term-y" aria-hidden>
        {gridLabels.map((bps) => (
          <span key={bps}>{bpsToOddsCents(bps)}¢</span>
        ))}
      </div>
      <div className="sf-term-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden focusable="false">
          {gridLabels.map((bps) => (
            <line key={bps} className="sf-term-grid" x1={0} x2={W} y1={(yPct(bps) / 100) * H} y2={(yPct(bps) / 100) * H} />
          ))}
          {priced.length >= 2 && <polyline className="sf-term-line" points={line} />}
        </svg>
        {points.map((p, i) => {
          const focal = p.marketId === focalId;
          if (!p.implied) {
            return (
              <span key={p.marketId} className="sf-term-gap" style={{ left: `${slot(i)}%` }} title={p.unavailable ? copy.unavailable : SURFACE.reading}>
                {p.structure === null ? "…" : "—"}
              </span>
            );
          }
          return (
            <button
              key={p.marketId}
              type="button"
              className={cn("sf-term-dot", focal && "sf-term-dot--focal")}
              style={{ left: `${slot(i)}%`, top: `${yPct(p.implied.bps)}%` }}
              aria-label={copy.pick(p.cadence)}
              aria-pressed={focal}
              title={copy.point(p.cadence, `${bpsToOddsCents(p.implied.bps)}¢`, copy.basis[p.implied.basis])}
              onClick={() => onPick(p.marketId)}
              data-cursor="hover"
            />
          );
        })}
      </div>
      <div className="sf-term-x" aria-hidden>
        {points.map((p) => (
          <span key={p.marketId} className={cn(p.marketId === focalId && "sf-term-x--focal")}>
            <b>{p.cadence}</b>
            <i>{p.remainingSec > 0 ? formatClock(p.remainingSec) : "—"}</i>
          </span>
        ))}
      </div>
    </div>
  );
}
