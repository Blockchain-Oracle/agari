import { STATS } from "./copy";

interface GrowthCurveProps {
  points: { atMs: number; cumulative: number }[];
  height?: number;
}

/**
 * The cumulative callers curve — the slope IS the story. Ported from the reference's `GrowthCurve`:
 * a single point renders as a dot, two or more as a glowing line over a gradient fill. No smoothing.
 * Colours come from `stats.css` through `currentColor` and the gradient's class, so no hex lives here.
 */
export function GrowthCurve({ points, height = 200 }: GrowthCurveProps) {
  const W = 920;
  const H = height;
  const padX = 16;
  const padT = 22;
  const padB = 26;
  if (points.length === 0) return <div className="stats-curve-empty">{STATS.curve.empty}</div>;

  const max = Math.max(1, ...points.map((p) => p.cumulative));
  const xAt = (i: number) => (points.length === 1 ? W / 2 : padX + (i / (points.length - 1)) * (W - 2 * padX));
  const yAt = (v: number) => H - padB - (v / max) * (H - padT - padB);
  const pts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.cumulative), p }));
  const line = pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  const lastX = points.length === 1 ? W / 2 : W - padX;
  const area = `${padX},${H - padB} ${line} ${lastX.toFixed(1)},${H - padB}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stats-curve" style={{ height }} preserveAspectRatio="none" role="img" aria-label={STATS.curve.axis}>
      <defs>
        <linearGradient id="stats-gc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="stats-curve-fill-top" />
          <stop offset="100%" className="stats-curve-fill-bottom" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} className="stats-curve-grid" x1={padX} x2={W - padX} y1={padT + g * (H - padT - padB)} y2={padT + g * (H - padT - padB)} strokeWidth={1} />
      ))}
      <polygon points={area} fill="url(#stats-gc)" stroke="none" />
      {pts.length > 1 && <polyline className="stats-curve-line" points={line} fill="none" strokeWidth={2.5} strokeLinejoin="round" />}
      {pts.map((q, i) => (
        <circle key={i} className={i === pts.length - 1 ? "stats-curve-dot last" : "stats-curve-dot"} cx={q.x} cy={q.y} r={i === pts.length - 1 ? 5 : 3} />
      ))}
      <text x={padX} y={14} className="stats-curve-axis">
        {STATS.curve.axis}
      </text>
      <text x={W - padX} y={14} textAnchor="end" className="stats-curve-max">
        {max}
      </text>
    </svg>
  );
}
