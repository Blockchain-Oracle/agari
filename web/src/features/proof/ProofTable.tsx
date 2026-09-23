import type { PrintProof } from "@agari/markets";
import { oraclePriceText } from "@/features/markets/hero";
import { isPreStocksAsset, printSourceName } from "@/features/markets/price-source/source-label";
import { PROOF } from "./copy";
import { crossCheckBpsText, crossCheckPair, replayDiff } from "./format";

type Tone = "good" | "warn" | "bad" | "off";

function rowOf(print: PrintProof): { tone: Tone; detail: string } {
  if (print.source === "pyth") {
    const replay = print.replay;
    const state = replay?.state ?? "none";
    // A stored decode that does not equal the print is never shown as proven (the replay refuses one; old rows may not).
    const diff = replay?.price != null && replay.expo != null ? replayDiff(replay.price, replay.expo, print.priceE8) : 0n;
    if ((state === "verified" || state === "closed") && diff !== 0n) return { tone: "bad", detail: PROOF.differs(diff.toString()) };
    return { tone: PROOF.tones[state], detail: PROOF.state[state] };
  }
  if (print.source === "redstone") {
    return { tone: print.archive ? "good" : "off", detail: `${PROOF.signerCount(print.signers)} · ${print.archive ? PROOF.redstoneVerified : PROOF.noArchive}` };
  }
  if (print.source === "attested") return isPreStocksAsset(print.symbol) ? { tone: "good", detail: PROOF.attestedPreStocks } : { tone: "off", detail: PROOF.attested };
  return { tone: print.archive ? "good" : "off", detail: PROOF.switchboard };
}

/** The Window's prints at a glance, in the status table's rows (Masayume `/status`): one dot per print, then the cross-check. */
export function ProofTable({ prints, singleSource }: { prints: readonly PrintProof[]; singleSource: boolean }) {
  const pair = crossCheckPair(prints);
  const bps = pair ? crossCheckBpsText(pair.primary.priceE8, pair.check.priceE8) : null;
  return (
    <div className="status-table">
      <div className="status-table-head">
        <h3 className="status-table-title">{PROOF.tableTitle(prints.length)}</h3>
      </div>
      <div className="status-table-body">
        {prints.map((print) => {
          const { tone, detail } = rowOf(print);
          return (
            <div key={`${print.which}:${print.recordSignature}`} className="status-row">
              <span className="status-dot" data-tone={tone} aria-hidden />
              <span className="status-row-label">{`${PROOF.which[print.which]} · ${print.source ? printSourceName(print.source, print.symbol) : PROOF.unknownSource}`}</span>
              <span className="status-row-lag">{oraclePriceText(print.priceE8, print.symbol ?? "")}</span>
              <span className="status-row-detail" title={detail}>
                {detail}
              </span>
            </div>
          );
        })}
        <div className="status-row">
          <span className="status-dot" data-tone={bps !== null ? "good" : "off"} aria-hidden />
          <span className="status-row-label">{PROOF.crossCheck}</span>
          <span className="status-row-lag">{bps !== null ? `${bps} bps` : "—"}</span>
          <span className="status-row-detail">{bps !== null ? PROOF.crossCheckBps(bps) : singleSource ? PROOF.singleSource : PROOF.noCheck}</span>
        </div>
      </div>
    </div>
  );
}
