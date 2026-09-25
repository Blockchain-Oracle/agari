import type { ChartPoint } from "@/features/markets/hero/useChartSeries";
import { ORACLE_SCALE } from "@/features/markets/hero/units";

/**
 * lightweight-charts' layout, restated for an SVG: the price scale's autoscale (the series and the reference line,
 * with its default 20 % / 10 % margins), round ticks no closer than the label height allows, and a time axis of
 * clock labels. Floats exist only here, at the drawing boundary, as they do in web's PriceChart.
 */
export const toValue = (raw: bigint): number => Number(raw) / 10 ** ORACLE_SCALE;

const MARGIN_TOP = 0.2;
const MARGIN_BOTTOM = 0.1;
/** A tick label is 12 px tall; lightweight-charts keeps about two and a half label heights between ticks. */
const MIN_TICK_GAP = 30;

export interface ChartLayout {
  /** The polyline in plot units. */
  path: string;
  last: { x: number; y: number; value: number };
  refY: number | null;
  ticks: { y: number; value: number }[];
  times: { x: number; label: string; major: boolean }[];
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

const clock = (sec: number): string => {
  const d = new Date(sec * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function layoutChart(points: readonly ChartPoint[], refRaw: bigint | null, width: number, height: number): ChartLayout | null {
  if (points.length < 2 || width <= 0 || height <= 0) return null;
  const values = points.map((p) => toValue(p.valueRaw));
  const ref = refRaw === null ? null : toValue(refRaw);
  let lo = Math.min(...values, ...(ref === null ? [] : [ref]));
  let hi = Math.max(...values, ...(ref === null ? [] : [ref]));
  if (hi - lo < 0.01) {
    lo -= 0.05;
    hi += 0.05;
  }
  const inner = height * (1 - MARGIN_TOP - MARGIN_BOTTOM);
  const perUnit = inner / (hi - lo);
  const top = hi + (height * MARGIN_TOP) / perUnit;
  const y = (v: number) => (top - v) * perUnit;

  const from = points[0]!.timeSec;
  const to = Math.max(points.at(-1)!.timeSec, from + 1);
  // fitContent: half a bar's spacing in from each edge.
  const pad = Math.min(12, width / (points.length * 2));
  const x = (sec: number) => pad + ((sec - from) / (to - from)) * (width - pad * 2);

  const step = niceStep(MIN_TICK_GAP / perUnit);
  const ticks: ChartLayout["ticks"] = [];
  const bottom = top - height / perUnit;
  for (let v = Math.ceil(bottom / step) * step; v <= top; v += step) {
    const ty = y(v);
    if (ty > 6 && ty < height - 6) ticks.push({ y: ty, value: v });
  }

  const span = to - from;
  const count = Math.max(2, Math.min(4, Math.floor(width / 110)));
  const times: ChartLayout["times"] = [];
  for (let i = 0; i < count; i++) {
    const sec = from + (span * (i + 0.5)) / count;
    times.push({ x: x(sec), label: clock(sec), major: i === 0 });
  }

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.timeSec).toFixed(1)},${y(values[i]!).toFixed(1)}`).join(" ");
  const lastValue = values.at(-1)!;
  return { path, last: { x: x(points.at(-1)!.timeSec), y: y(lastValue), value: lastValue }, refY: ref === null ? null : y(ref), ticks, times };
}

/**
 * The scale's round-price labels that stay clear of the boxed tags (the last value, the reference line): as
 * lightweight-charts does, a tick label a tag would overlap is not drawn — the tag wins.
 */
export function clearTicks(chart: ChartLayout, labelH: number): ChartLayout["ticks"] {
  const tags = [chart.last.y, ...(chart.refY === null ? [] : [chart.refY])];
  return chart.ticks.filter((tick) => tags.every((y) => Math.abs(tick.y - y) >= labelH));
}
