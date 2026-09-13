import type { EquityPoint } from "@masayume/core/projection";
import { oneUnit } from "@masayume/core/units";
import { cn } from "@/lib/utils";
import { EDGE } from "./copy";
import type { Tone } from "./format";

const CHART_W = 760;
const CHART_H = 230;
const PAD = 10;

interface EdgeCurveProps {
  points: readonly EquityPoint[];
  decimals: number;
  tone: Tone;
  label: string;
}

/** Geometry only: base units become floats here to place pixels, never to state a figure. */
function curvePaths(points: readonly EquityPoint[], decimals: number) {
  if (points.length < 2) return { line: "", area: "", lastX: PAD, lastY: CHART_H / 2, zeroY: CHART_H / 2 };
  const one = Number(oneUnit(decimals));
  const values = points.map((point) => Number(point.cumulativeBase) / one);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (max - min < 0.01) {
    min = -0.5;
    max = 0.5;
  }
  const span = max - min;
  const x = (index: number) => PAD + (index / (points.length - 1)) * (CHART_W - PAD * 2);
  const y = (value: number) => PAD + ((max - value) / span) * (CHART_H - PAD * 2);
  const line = values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const lastX = x(points.length - 1);
  const lastY = y(values[values.length - 1] as number);
  const zeroY = y(0);
  return { line, area: `${line} L${lastX},${zeroY} L${x(0)},${zeroY} Z`, lastX, lastY, zeroY };
}

/** The reference's cumulative-result chart: a dashed zero line, a soft fill, the line, and a ringed marker at the latest close. */
export function EdgeCurve({ points, decimals, tone, label }: EdgeCurveProps) {
  const chart = curvePaths(points, decimals);
  return (
    <>
      <svg className={cn("edge-chart", `is-${tone}`)} viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={label}>
        <line x1={PAD} y1={chart.zeroY} x2={CHART_W - PAD} y2={chart.zeroY} className="edge-chart-zero" strokeDasharray="4 7" />
        <path d={chart.area} className="edge-chart-area" />
        <path d={chart.line} fill="none" className="edge-chart-line" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={chart.lastX} cy={chart.lastY} r="5" className="edge-chart-marker" />
      </svg>
      <div className="edge-chart-caption">
        <span>{EDGE.report.firstClose}</span>
        <span>{EDGE.report.latestClose}</span>
      </div>
    </>
  );
}
