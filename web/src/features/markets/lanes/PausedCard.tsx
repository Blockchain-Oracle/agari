import type { TickerSymbol } from "@agari/core/market";
import { formatCadence, MARKETS } from "@/lib/copy";
import { AssetDisc } from "../hero/asset-mark";

interface PausedCardProps {
  asset: TickerSymbol;
  intervalSec: number;
  /** The roller's own state for the lane, e.g. `paused: no signed source`, `paused: corporate action (split)`. */
  state: string;
}

/**
 * A ticker the roller has paused, in the lane where its Window would sit — Yosuku's between-rounds slot
 * (`RailPlaceholder`, reference/yosuku/app/markets/page.tsx L74–95), markup for markup. Not a button:
 * there is nothing to open.
 */
export function PausedCard({ asset, intervalSec, state }: PausedCardProps) {
  const cadence = formatCadence(intervalSec);
  const headline = state.startsWith("paused: corporate action") ? MARKETS.paused.corporateAction : MARKETS.paused.noSource;
  return (
    <div className="market-card market-card-pending">
      <div className="mc-head">
        <span className="mc-asset">
          <AssetDisc asset={asset} className="glyph" />
          <span className="mc-ticker">{asset}</span>
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
          <strong>{headline}.</strong> {MARKETS.paused.why(asset, cadence)}
        </p>
      </div>
    </div>
  );
}
