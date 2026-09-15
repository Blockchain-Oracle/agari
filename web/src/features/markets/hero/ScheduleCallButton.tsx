import type { TickerSymbol } from "@agari/core/market";
import type { MarketSession } from "../session";

export interface ScheduleCallButtonProps {
  asset: TickerSymbol;
  session: MarketSession | null;
  className?: string;
}

/**
 * The pre-open call's seam (D-088): "Schedule a call" on a listed Window while the market is closed. Lane 18f fills it
 * once the program admits post-only orders on Listed; until then the closed hero, the ticket placeholder and the next
 * Window cards render nothing here rather than a button that cannot act.
 */
export function ScheduleCallButton(_props: ScheduleCallButtonProps): null {
  return null;
}
