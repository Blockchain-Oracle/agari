"use client";

import { cumulativeDepth, depthBounds, type DepthStep } from "@masayume/core/surface";
import type { BookDepth } from "@masayume/core/types";
import { bpsToOddsCents } from "@masayume/core/units";
import { SURFACE } from "./copy";
import { contractsText } from "./format";

interface DepthChartProps {
  depth: BookDepth | null;
  hydrating: boolean;
}

const W = 1000;
const H = 100;
/** `drawIvLine` rules three bands of grid — four lines, four labels down the left. */
const GRID_ROWS = 3;

interface Scale {
  x: (bps: number) => number;
  y: (raw: bigint) => number;
}

/** A step area from the top of the book outward: bids walk left toward `edgeBps`, asks walk right. */
function stepArea(steps: readonly DepthStep[], edgeBps: number, { x, y }: Scale): string {
  if (steps.length === 0) return "";
  const first = steps[0]!;
  const parts = [`M${x(first.priceBps).toFixed(1)},${H}`];
  let level = 0n;
  for (const step of steps) {
    parts.push(`L${x(step.priceBps).toFixed(1)},${y(level).toFixed(1)}`);
    level = step.cumulativeRaw;
    parts.push(`L${x(step.priceBps).toFixed(1)},${y(level).toFixed(1)}`);
  }
  parts.push(`L${x(edgeBps).toFixed(1)},${y(level).toFixed(1)}`, `L${x(edgeBps).toFixed(1)},${H}`, "Z");
  return parts.join(" ");
}

/**
 * §02 — the reference's smile box (`SurfacePage` L279–292: `drawIvLine` in a 220px box), drawn on the
 * venue's real structure. There is no volatility model to read back; what a book has is depth —
 * cumulative size at each price, both sides on the UP axis. The grammar is `drawIvLine`'s exactly:
 * a 44px column of y labels, three bands of grid, the dashed vermilion marker, x labels under the
 * plot, and the figures in a 10px line beneath the box — with contracts up the side and prices along
 * the bottom. `TermChart` draws §04 the same way. SVG rather than canvas so the paths scale with the
 * box and every stroke stays one device pixel (`vector-effect`); the labels are HTML so they never
 * stretch with the plot.
 */
export function DepthChart({ depth, hydrating }: DepthChartProps) {
  const copy = SURFACE.depth;
  const bids = depth ? cumulativeDepth(depth.upBids) : [];
  const asks = depth ? cumulativeDepth(depth.upAsks) : [];
  const bounds = depthBounds(bids, asks);

  if (!depth || !bounds) {
    return (
      <div className="sf-box sf-box--chart">
        <div className="sf-box-empty">{hydrating || !depth ? copy.hydrating : copy.empty}</div>
      </div>
    );
  }

  const span = Math.max(1, bounds.maxBps - bounds.minBps);
  const tall = bounds.maxCumulativeRaw;
  const scale: Scale = {
    x: (bps) => ((bps - bounds.minBps) / span) * W,
    y: (raw) => (tall === 0n ? H : H - Number((raw * 1000n) / tall) / 10),
  };
  const bestBid = bids[0] ?? null;
  const bestAsk = asks[0] ?? null;
  const crossed = bestBid !== null && bestAsk !== null && bestBid.priceBps >= bestAsk.priceBps;
  const midBps = bestBid && bestAsk && !crossed ? (bestBid.priceBps + bestAsk.priceBps) / 2 : null;
  const totalBids = bids.at(-1)?.cumulativeRaw ?? 0n;
  const totalAsks = asks.at(-1)?.cumulativeRaw ?? 0n;
  // The labels read down the column, so the top band comes first: tall, ⅔, ⅓, 0.
  const gridRows = Array.from({ length: GRID_ROWS + 1 }, (_, i) => (tall * BigInt(GRID_ROWS - i)) / BigInt(GRID_ROWS));
  // The reference labels its first, middle and last strike; here the plot's two edges and its centre.
  const xLabels = [bounds.minBps, (bounds.minBps + bounds.maxBps) / 2, bounds.maxBps];
  const left = (bps: number) => `${((scale.x(bps) / W) * 100).toFixed(2)}%`;
  const label = `${copy.bids} ${contractsText(totalBids, depth.decimals)}, ${copy.asks} ${contractsText(totalAsks, depth.decimals)}`;

  return (
    <>
      <div className="sf-box sf-box--chart sf-term sf-depth" role="img" aria-label={label}>
        <div className="sf-term-y" aria-hidden>
          {gridRows.map((raw, i) => (
            <span key={i}>{contractsText(raw, depth.decimals)}</span>
          ))}
        </div>
        <div className="sf-term-plot">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden focusable="false">
            {gridRows.map((raw, i) => (
              <line key={i} className="sf-term-grid" x1={0} x2={W} y1={scale.y(raw)} y2={scale.y(raw)} />
            ))}
            <path className="sf-depth-area sf-depth-area--bids" d={stepArea(bids, bounds.minBps, scale)} />
            <path className="sf-depth-area sf-depth-area--asks" d={stepArea(asks, bounds.maxBps, scale)} />
          </svg>
          {midBps !== null && (
            <span className="sf-depth-mid" style={{ left: left(midBps) }} aria-hidden>
              <span className="sf-depth-mid-label">{copy.mid(`${bpsToOddsCents(midBps)}¢`)}</span>
            </span>
          )}
          {crossed && <span className="sf-depth-crossed">{copy.crossed}</span>}
        </div>
        <div className="sf-depth-x" aria-hidden>
          {xLabels.map((bps, i) => (
            <span key={i} style={{ left: left(bps) }}>
              {bpsToOddsCents(bps)}¢
            </span>
          ))}
        </div>
      </div>
      {/* the reference's mono line under its box (`a=… b=…`) carries the book's two figures here */}
      <div className="sf-params">
        <span>
          {copy.bids} <b>{bestBid ? `${bpsToOddsCents(bestBid.priceBps)}¢` : "—"}</b> · {copy.contracts(contractsText(totalBids, depth.decimals))}
        </span>
        <span>
          {copy.asks} <b>{bestAsk ? `${bpsToOddsCents(bestAsk.priceBps)}¢` : "—"}</b> · {copy.contracts(contractsText(totalAsks, depth.decimals))}
        </span>
      </div>
    </>
  );
}
