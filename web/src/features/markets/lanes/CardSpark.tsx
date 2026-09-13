"use client";

import { LANE_CARD } from "@/lib/copy";
import type { ChartPoint } from "../hero/useChartSeries";

interface CardSparkProps {
  points: readonly ChartPoint[];
  /** The line the Window settles against; drawn as the dashed strike rule when known. */
  openingRaw: bigint | null;
}

const VIEW_W = 100;
const VIEW_H = 40;

interface Plot {
  path: string;
  /** Where the opening print sits, top-down, as a percentage of the box. */
  strikeTopPct: number | null;
  /**
   * Whether UP is currently winning — the price at or above the line.
   *
   * Not the series' own direction. Those differ often, and when they do the card
   * contradicts itself: a Window can rally hard off its low and still sit well
   * under its opening print, which drew a green line beside a red −$1,419. The
   * only question this card asks is which side of the line the price is on, so
   * that is what the colour answers. With no line yet there is no side, and the
   * series' direction is the honest fallback.
   */
  winning: boolean;
}

/**
 * Fits the series to the box and places the strike rule inside the same scale.
 *
 * The band is widened to include the opening print whenever it is known, so the
 * dashed rule and the line are read against one another rather than the rule
 * being clamped to an edge and implying the price never came near it.
 */
function plot(points: readonly ChartPoint[], openingRaw: bigint | null): Plot | null {
  if (points.length < 2) return null;

  const values = points.map((point) => point.valueRaw);
  let low = values.reduce((a, b) => (a < b ? a : b));
  let high = values.reduce((a, b) => (a > b ? a : b));
  if (openingRaw !== null) {
    if (openingRaw < low) low = openingRaw;
    if (openingRaw > high) high = openingRaw;
  }

  const span = high - low;
  // A dead-flat series has no band to scale into; draw it down the middle.
  const y = (value: bigint): number => (span === 0n ? VIEW_H / 2 : VIEW_H - Number(((value - low) * 1000n) / span) / 1000 * VIEW_H);
  const x = (index: number): number => (index / (points.length - 1)) * VIEW_W;

  const latest = points.at(-1)?.valueRaw ?? 0n;
  return {
    path: points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point.valueRaw).toFixed(2)}`).join(" "),
    strikeTopPct: openingRaw === null ? null : (y(openingRaw) / VIEW_H) * 100,
    winning: openingRaw === null ? latest >= (points[0]?.valueRaw ?? 0n) : latest >= openingRaw,
  };
}

/**
 * The card's sparkline — the reference's `Spark624`, as SVG rather than canvas.
 *
 * Yosuku draws one `<canvas>` per card through `drawPriceLine`. A rail here holds
 * every Window of the active lane rather than the reference's fixed three, so the
 * cost scales with the venue: SVG costs nothing per card, needs no ref, no effect
 * and no redraw on resize, and it is the same picture. The strike rule and its tick
 * stay the absolutely-positioned elements `part-06.css` already styles for them.
 *
 * `preserveAspectRatio="none"` is what lets a fixed viewBox fill the 110px box.
 */
export function CardSpark({ points, openingRaw }: CardSparkProps) {
  const shape = plot(points, openingRaw);
  if (shape === null) return null;

  return (
    <>
      <svg className="mc-spark-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden focusable="false">
        <path className={shape.winning ? "mc-spark-line up" : "mc-spark-line down"} d={shape.path} />
      </svg>
      {shape.strikeTopPct !== null && (
        <>
          <div className="strike-line" style={{ top: `${shape.strikeTopPct}%` }} aria-hidden />
          {/* `.strike-tick` is already styled in part-06.css; without it the dashed
              rule is an unlabelled line rather than the level being asked about. */}
          <div className="strike-tick" style={{ top: `${shape.strikeTopPct}%` }} aria-hidden>
            {LANE_CARD.line}
          </div>
        </>
      )}
    </>
  );
}
