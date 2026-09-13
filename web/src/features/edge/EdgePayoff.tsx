import type { TraderEdge } from "@masayume/core/projection";
import { formatBaseUnits } from "@masayume/core/units";
import { EDGE } from "./copy";

function Row({ name, value }: { name: string; value: string }) {
  return (
    <div className="edge-payoff-row">
      <span className="edge-payoff-name">{name}</span>
      <span className="edge-payoff-value">{value}</span>
    </div>
  );
}

/** The shape of the payoff, and the sentence that says where every number came from. */
export function EdgePayoff({ report, decimals, symbol }: { report: TraderEdge; decimals: number; symbol: string }) {
  const words = EDGE.report.payoff;
  const money = (value: bigint) => `${formatBaseUnits(value, decimals)} ${symbol}`;
  return (
    <aside className="edge-payoff-panel edge-enter">
      <h2 className="edge-section-title">{words.title}</h2>
      <div className="edge-payoff-rows">
        <Row name={words.averageWin} value={report.averageWinBase === null ? words.noWins : `+${money(report.averageWinBase)}`} />
        <Row name={words.averageLoss} value={report.averageLossBase === null ? words.noLosses : `-${money(report.averageLossBase)}`} />
        <Row name={words.bestRun} value={words.runs(report.bestWinStreak)} />
        <Row name={words.fees} value={money(report.settlementFeesBase)} />
        <Row name={words.stake} value={money(report.stakeBase)} />
      </div>
      <div className="edge-provenance">
        <div className="edge-label">{words.provenanceLabel}</div>
        <p>{words.provenance}</p>
      </div>
    </aside>
  );
}
