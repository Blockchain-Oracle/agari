import type { EventMarket } from "@agari/core/types";
import { priceSourceLine } from "../lanes/lane-view";

/**
 * Names the settlement basis the chart and the model read (FR-7): the UI never hides which price decides. A token Window
 * settles on the Switchboard xStock price, a Gap on the Friday and Monday prints (session-lanes.md §5).
 */
export function PriceSourceNote({ market }: { market: Pick<EventMarket, "asset" | "lane" | "tradingStartSec" | "expirySec"> }) {
  return <p className="type-caption text-ink-muted">{priceSourceLine(market)}</p>;
}
