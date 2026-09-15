import type { TickerSymbol } from "@agari/core/market";
import type { LaneBasis } from "@agari/core/types";
import { MARKETS } from "@/lib/copy";
import { AssetDisc } from "../hero/asset-mark";
import { laneAssetLabel, laneCadenceLabel, pausedCopy } from "./lane-view";

interface PausedCardProps {
  asset: TickerSymbol;
  basis: LaneBasis;
  intervalSec: number;
  /** The roller's own state for the lane: `paused: no signed source`, `paused: corporate action (split)`, `paused: halted (pyth-wide)`. */
  state: string;
}

/**
 * A ticker the roller has paused, in the lane where its Window would sit — Yosuku's between-rounds slot
 * (`RailPlaceholder`, reference/yosuku/app/markets/page.tsx L74–95), markup for markup. Not a button:
 * there is nothing to open.
 */
export function PausedCard({ asset, basis, intervalSec, state }: PausedCardProps) {
  const cadence = laneCadenceLabel(basis, intervalSec);
  const label = laneAssetLabel(asset, basis);
  const { headline, why } = pausedCopy(state, label, basis, intervalSec);
  return (
    <div className="market-card market-card-pending" data-lane={basis}>
      <div className="mc-head">
        <span className="mc-asset">
          <AssetDisc asset={asset} className="glyph" />
          <span className="mc-ticker">{label}</span>
          <span className="mc-cadence">{cadence}</span>
        </span>
        <span className="mc-countdown">
          <span className="clock-dot" aria-hidden />
          {MARKETS.paused.clock}
        </span>
      </div>
      <div className="mc-pending">
        <span className="mc-pending-dot" aria-hidden />
        <p className="mc-pending-copy">
          <strong>{headline}.</strong> {why}
        </p>
      </div>
    </div>
  );
}
