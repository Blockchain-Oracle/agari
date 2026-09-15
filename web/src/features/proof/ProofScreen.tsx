"use client";

import { etDateOf, formatCadence, formatEtClock } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { MarketId } from "@agari/core/types";
import { useMarket, useResolution } from "@agari/markets/react";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { SectionHeader } from "@/components/chrome";
import { PROOF } from "./copy";
import { PrintProofReceipt } from "./PrintProofReceipt";
import { ProofTable } from "./ProofTable";
import { ReverifyButton } from "./ReverifyButton";
import { useMarketProof } from "./useMarketProof";
import "./proof-page.css";

const index = (n: number) => String(n).padStart(2, "0");

/**
 * `/proof/<market>` (proof-analytics.md §2.6): Masayume's `/status` page frame (numbered header, holding states, the
 * pipeline table) over the Window's prints, then one cream receipt per print, as the verdict receipt audits a payout.
 */
export function ProofScreen({ marketId }: { marketId: MarketId }) {
  const { reading, refresh } = useMarketProof(marketId);
  const market = useMarket(marketId);
  const resolution = useResolution(marketId);
  const window = market && isOk(market) ? market.value : null;
  const singleSource = resolution && isOk(resolution) ? resolution.value.singleSource : false;
  const desc = window ? PROOF.window(window.asset, formatCadence(window.intervalSec), `${formatEtClock(window.expirySec)} ET · ${etDateOf(window.expirySec)}`) : undefined;

  return (
    <div className="container status-page proof-page">
      <SectionHeader index={PROOF.section.index} title={PROOF.section.title} desc={desc} />
      <p className="proof-intro type-body text-ink-secondary">{PROOF.intro}</p>

      {reading === null && (
        <div className="status-holding" role="status" aria-busy="true">
          <RefreshCwIcon className="status-holding-icon animate-spin" aria-hidden />
          <p className="status-holding-text">{PROOF.loading}</p>
        </div>
      )}

      {reading !== null && !reading.ok && (
        <div className="status-holding" role="alert">
          <AlertTriangleIcon className="status-holding-icon warn" aria-hidden />
          <p className="status-holding-text">{PROOF.unreachable}</p>
        </div>
      )}

      {reading?.ok && reading.value.length === 0 && (
        <div className="status-holding" role="status">
          <p className="status-holding-text">{PROOF.none}</p>
        </div>
      )}

      {reading?.ok && reading.value.length > 0 && (
        <div className="status-report">
          <ProofTable prints={reading.value} singleSource={singleSource} />
          <div className="proof-prints">
            {reading.value.map((print, i) => (
              <section key={print.which} className="proof-print">
                <SectionHeader
                  index={index(i + 1)}
                  title={PROOF.which[print.which]}
                  aside={print.source === "pyth" ? <ReverifyButton marketId={marketId} which={print.which} state={print.replay?.state ?? null} onStarted={refresh} /> : undefined}
                />
                <PrintProofReceipt print={print} />
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
