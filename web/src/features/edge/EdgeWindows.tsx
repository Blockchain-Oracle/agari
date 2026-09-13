import type { EdgeWindow } from "@masayume/core/projection";
import { cn } from "@/lib/utils";
import { EDGE } from "./copy";
import { signedMoney } from "./format";

const MIN_BAR_PCT = 4;

/** Time-of-day split bars: losses grow left from the zero rule, gains grow right — the reference's own encoding. */
export function EdgeWindows({ windows, decimals, symbol }: { windows: readonly EdgeWindow[]; decimals: number; symbol: string }) {
  const words = EDGE.report.windows;
  const timed = windows.reduce((sum, window) => sum + window.count, 0);
  const maxAbs = windows.reduce((max, window) => {
    const abs = window.netBase < 0n ? -window.netBase : window.netBase;
    return abs > max ? abs : max;
  }, 1n);

  return (
    <section className="edge-enter">
      <h2 className="edge-section-title">{words.title}</h2>
      <p className="edge-section-copy">{words.copy}</p>
      {timed === 0 ? (
        <p className="edge-state-copy">{words.unreadable}</p>
      ) : (
        <div className="edge-window-list">
          {windows.map((window) => {
            const positive = window.netBase >= 0n;
            const abs = window.netBase < 0n ? -window.netBase : window.netBase;
            const pct = window.count === 0 ? 0 : Math.max(MIN_BAR_PCT, Number((abs * 100n) / maxAbs));
            const label = words.labels[window.key];
            return (
              <div className="edge-window-row" key={window.key}>
                <div>
                  <div className="edge-window-name">{label.label}</div>
                  <div className="edge-window-range">{label.range}</div>
                </div>
                <div className="edge-split-bar" aria-hidden="true">
                  <div className="edge-bar-half">{!positive && window.count > 0 ? <span className="edge-loss-bar" style={{ width: `${pct}%` }} /> : null}</div>
                  <span className="edge-zero" />
                  <div className="edge-bar-half">{positive && window.count > 0 ? <span className="edge-gain-bar" style={{ width: `${pct}%` }} /> : null}</div>
                </div>
                <div className="edge-window-result">
                  <div className={cn("edge-window-net", window.count === 0 ? "is-faint" : positive ? "is-gain" : "is-loss")}>
                    {window.count === 0 ? words.none : signedMoney(window.netBase, decimals, symbol)}
                  </div>
                  <div className="edge-window-count">{words.rounds(window.count)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
