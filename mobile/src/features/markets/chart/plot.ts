import type { ChartPoint } from "@/features/markets/hero/useChartSeries";

/**
 * The chart's scale, shared by the Window line and the card spark (web's CardSpark `plot`, generalised). Money and
 * prices stay bigint upstream; floats exist only here, at the drawing boundary.
 */
export interface Plot {
  /** The polyline through every sample, in view units. */
  path: string;
  /** Where the strike (opening print) sits, top-down; null when there is no line yet. */
  strikeY: number | null;
  /** The oldest and newest samples' positions. */
  first: { x: number; y: number };
  last: { x: number; y: number };
  /** UP is winning: the newest sample at or above the strike (the series' own direction when there is no strike). */
  winning: boolean;
  low: bigint;
  high: bigint;
}

export interface PlotBox {
  width: number;
  height: number;
  /** Vertical breathing room above and below the band, in view units. */
  padY?: number;
  /** A fixed time domain (the Window's own span) so the line grows toward the bell; the samples' span otherwise. */
  domain?: { fromSec: number; toSec: number } | null;
}

export function plotSeries(points: readonly ChartPoint[], strikeRaw: bigint | null, box: PlotBox): Plot | null {
  if (points.length < 2 || box.width <= 0 || box.height <= 0) return null;
  const padY = box.padY ?? 8;
  let low = points[0]!.valueRaw;
  let high = low;
  for (const point of points) {
    if (point.valueRaw < low) low = point.valueRaw;
    if (point.valueRaw > high) high = point.valueRaw;
  }
  if (strikeRaw !== null) {
    if (strikeRaw < low) low = strikeRaw;
    if (strikeRaw > high) high = strikeRaw;
  }
  const span = high - low;
  const inner = box.height - padY * 2;
  // A dead-flat series has no band to scale into: draw it down the middle.
  const y = (value: bigint): number => (span === 0n ? box.height / 2 : padY + inner - (Number(((value - low) * 10_000n) / span) / 10_000) * inner);

  const fromSec = box.domain?.fromSec ?? points[0]!.timeSec;
  const toSec = Math.max(box.domain?.toSec ?? points.at(-1)!.timeSec, fromSec + 1);
  const x = (timeSec: number): number => ((Math.min(Math.max(timeSec, fromSec), toSec) - fromSec) / (toSec - fromSec)) * box.width;

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.timeSec).toFixed(1)},${y(point.valueRaw).toFixed(1)}`).join(" ");
  const newest = points.at(-1)!;
  const winning = strikeRaw === null ? newest.valueRaw >= points[0]!.valueRaw : newest.valueRaw >= strikeRaw;
  return {
    path,
    strikeY: strikeRaw === null ? null : y(strikeRaw),
    first: { x: x(points[0]!.timeSec), y: y(points[0]!.valueRaw) },
    last: { x: x(newest.timeSec), y: y(newest.valueRaw) },
    winning,
    low,
    high,
  };
}
