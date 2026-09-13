"use client";

import { phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import type { EventMarket, MarketId } from "@masayume/core/types";
import { useLanes } from "@masayume/markets/react";
import { useMemo } from "react";
import { useVenue } from "../markets/useVenue";

export interface ParlayWindows {
  /** Every Window a leg may name right now: Trading, entry still open, soonest first. */
  windows: EventMarket[];
  byId: Map<MarketId, EventMarket>;
  loading: boolean;
}

/**
 * The reference's `btcBells` (`useOracles().active`, BTC only): here the venue's live Up/Down
 * Windows across every lane and asset, in the order they settle. A Window inside its no-entry
 * buffer is out — the reserve would refuse the leg, so the picker never offers it.
 */
export function useParlayWindows(nowMs: number): ParlayWindows {
  const { venueId } = useVenue();
  const reading = useLanes(venueId);
  return useMemo(() => {
    const laneSet = reading && isOk(reading) ? reading.value : null;
    const windows = (laneSet?.lanes ?? [])
      .flatMap((lane) => lane.markets)
      .filter((market) => nowMs > 0 && phase(market, nowMs) === "trading")
      .sort((a, b) => a.expirySec - b.expirySec);
    return { windows, byId: new Map(windows.map((market) => [market.marketId, market])), loading: reading === null };
  }, [reading, nowMs]);
}
