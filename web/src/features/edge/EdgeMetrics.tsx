import type { TraderEdge } from "@masayume/core/projection";
import { formatBaseUnits } from "@masayume/core/units";
import { cn } from "@/lib/utils";
import { EDGE } from "./copy";
import { signedMoney, toneOf, type Tone } from "./format";

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: Tone }) {
  return (
    <div className="edge-metric">
      <div className="edge-label">{label}</div>
      <div className={cn("edge-metric-value", tone && tone !== "flat" && `is-${tone}`)}>{value}</div>
      <div className="edge-metric-note">{note}</div>
    </div>
  );
}

/** Four figures, each with the sentence that says what it is measured over. */
export function EdgeMetrics({ report, decimals, symbol }: { report: TraderEdge; decimals: number; symbol: string }) {
  const m = EDGE.report.metrics;
  return (
    <section className="edge-metrics edge-enter" aria-label="Performance metrics">
      <Metric label={m.winRate.label} value={report.winRatePct === null ? m.winRate.unset : `${report.winRatePct.toFixed(0)}%`} note={m.winRate.note(report.wins, report.losses)} />
      <Metric label={m.profitFactor.label} value={report.profitFactor === null ? m.profitFactor.noLoss : report.profitFactor.toFixed(2)} note={m.profitFactor.note} />
      <Metric
        label={m.expectancy.label}
        value={report.expectancyBase === null ? m.expectancy.unset : signedMoney(report.expectancyBase, decimals, symbol)}
        note={m.expectancy.note}
        tone={report.expectancyBase === null ? undefined : toneOf(report.expectancyBase)}
      />
      <Metric label={m.drawdown.label} value={formatBaseUnits(report.maxDrawdownBase, decimals)} note={m.drawdown.note(symbol)} />
    </section>
  );
}
