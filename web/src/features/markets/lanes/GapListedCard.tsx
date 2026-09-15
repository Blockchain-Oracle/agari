import type { EventMarket } from "@agari/core/types";
import { LANE_STATE } from "@/lib/copy";
import { AssetDisc } from "../hero/asset-mark";
import { etWhen } from "./lane-view";

/**
 * A listed Gap Window before Friday's close (session-lanes.md §5 "Gap Listed"): the reference's between-rounds slot
 * (`.market-card-pending`, M `part-06.css:56-70`, as `PausedCard` draws it), saying when calls open, when they lock and
 * which print settles it. Not a button: there is nothing to call yet.
 */
export function GapListedCard({ market }: { market: Pick<EventMarket, "asset" | "tradingStartSec" | "lockAtSec" | "expirySec"> }) {
  return (
    <div className="market-card market-card-pending" data-lane="gap">
      <div className="mc-head">
        <span className="mc-asset">
          <AssetDisc asset={market.asset} className="glyph" />
          <span className="mc-ticker">{market.asset}</span>
          <span className="mc-cadence">{LANE_STATE.tab.gap}</span>
        </span>
        <span className="mc-countdown">
          <span className="clock-dot" aria-hidden />
          {LANE_STATE.gap.listedClock}
        </span>
      </div>
      <div className="mc-pending">
        <span className="mc-pending-dot" aria-hidden />
        <p className="mc-pending-copy">
          <strong>{LANE_STATE.gap.listed(etWhen(market.tradingStartSec))}.</strong> {LANE_STATE.gap.listedWhy(etWhen(market.lockAtSec), etWhen(market.expirySec, true))}
        </p>
      </div>
    </div>
  );
}
