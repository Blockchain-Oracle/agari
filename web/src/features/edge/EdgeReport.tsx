import type { TraderEdge, WalletHistory } from "@masayume/core/projection";
import { cn } from "@/lib/utils";
import { EDGE } from "./copy";
import { EdgeCurve } from "./EdgeCurve";
import { EdgeMetrics } from "./EdgeMetrics";
import { EdgePayoff } from "./EdgePayoff";
import { EdgeWindows } from "./EdgeWindows";
import { signedMoney, signedPct, toneOf } from "./format";

function readoutText(report: TraderEdge, decimals: number, symbol: string): string {
  const words = EDGE.report.readout;
  const r = report.readout;
  switch (r.kind) {
    case "more-rounds":
      return words.moreRounds(r.needed);
    case "best-window":
      return words.bestWindow(EDGE.report.windows.labels[r.window.key].label, signedMoney(r.window.netBase, decimals, symbol), r.window.count);
    case "profit-factor":
      return words.profitFactor(r.factor.toFixed(2), symbol);
    case "drawdown":
      return words.drawdown(`${signedMoney(r.drawdownBase, decimals, symbol).replace(/^\+/, "")}`);
    case "flat":
      return words.flat;
  }
}

/** The report proper: the curve and its readout, the four metrics, then timing and payoff. */
export function EdgeReport({ history, report, symbol }: { history: WalletHistory; report: TraderEdge; symbol: string }) {
  const { decimals } = history;
  const tone = toneOf(report.netBase);
  const net = signedMoney(report.netBase, decimals);
  const [settledLine, openLine] = EDGE.report.sample(report.settledRounds, report.openRounds);

  return (
    <div className="edge-report">
      {!history.complete && <p className="edge-partial">{EDGE.states.partial}</p>}
      <div className="edge-hero-grid edge-enter">
        <section className="edge-curve-panel" aria-labelledby="edge-net-title">
          <div className="edge-panel-head">
            <div>
              <div id="edge-net-title" className="edge-label">
                {EDGE.report.netLabel}
              </div>
              <div className={cn("edge-net", `is-${tone}`)}>
                {net}
                <span className="edge-unit">{symbol}</span>
              </div>
              <div className="edge-roi">{report.roiPct === null ? EDGE.report.roiUnavailable : EDGE.report.roi(signedPct(report.roiPct))}</div>
            </div>
            <div className="edge-sample">
              {settledLine}
              <br />
              {openLine}
            </div>
          </div>
          <EdgeCurve points={report.equity} decimals={decimals} tone={tone} label={EDGE.report.chartLabel(`${net} ${symbol}`, report.settledRounds)} />
        </section>

        <aside className="edge-readout-panel">
          <div>
            <div className="edge-label">{EDGE.report.readoutLabel}</div>
            <p className="edge-readout-text">{readoutText(report, decimals, symbol)}</p>
          </div>
          <p className="edge-readout-foot">{EDGE.report.readoutFoot}</p>
        </aside>
      </div>

      <EdgeMetrics report={report} decimals={decimals} symbol={symbol} />

      <div className="edge-lower-grid">
        <EdgeWindows windows={report.windows} decimals={decimals} symbol={symbol} />
        <EdgePayoff report={report} decimals={decimals} symbol={symbol} />
      </div>

      <p className="edge-footer-note">{EDGE.report.footer}</p>
    </div>
  );
}
