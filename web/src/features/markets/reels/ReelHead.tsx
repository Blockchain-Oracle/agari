"use client";

import { countdown } from "@masayume/core/lifecycle";
import type { EventMarket } from "@masayume/core/types";
import { formatClock } from "@masayume/core/units";
import { formatCadence, REELS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useChainNowMs } from "../useChainNow";
import { AssetDisc } from "../hero/asset-mark";

interface ReelHeadProps {
  market: EventMarket;
}

/** Local wall-clock hour and minute — the reference's `clockHM`, in the viewer's own zone. */
function closesAt(expirySec: number): string {
  return new Date(expirySec * 1_000).toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit" });
}

/**
 * Asset, round length, closing time, and the bell — everything above the question. The clock is read
 * here rather than passed down, so the memoised card above holds no value that ticks.
 */
export function ReelHead({ market }: ReelHeadProps) {
  const nowMs = useChainNowMs();
  const state = nowMs > 0 ? countdown(nowMs, market.expirySec, market.intervalSec) : null;
  return (
    <div className="reel-head">
      <div className="reel-ident">
        <AssetDisc asset={market.asset} className="reel-badge" />
        <div>
          <div className="reel-meta">{REELS.settlesOn(market.asset)}</div>
          <div className="reel-submeta">{REELS.round(formatCadence(market.intervalSec), closesAt(market.expirySec))}</div>
        </div>
      </div>
      <div className={cn("reel-clock", state?.urgent && "urgent")}>
        <span className="reel-clock-label">{REELS.closesIn}</span>
        <span className="reel-clock-value">{state ? formatClock(state.remainingSec) : REELS.noClock}</span>
      </div>
    </div>
  );
}
