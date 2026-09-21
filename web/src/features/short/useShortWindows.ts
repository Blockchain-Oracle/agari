"use client";

import { phase } from "@agari/core/lifecycle";
import { isOk } from "@agari/core/schemas";
import type { TickerSymbol } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { useMemo } from "react";
import { useVenue } from "../markets/useVenue";

export interface ShortStock {
  asset: TickerSymbol;
  /** Every Window of that stock a short may still enter, soonest to settle first. */
  windows: EventMarket[];
}

export interface ShortWindows {
  stocks: ShortStock[];
  loading: boolean;
}

/**
 * The stocks a short can be opened on, one entry per asset.
 *
 * A short is picked in two steps — the stock, then how long to hold it — which is also what keeps this cheap:
 * the grid itself reads no books, and only the chosen stock's handful of Windows subscribe to one. Listing
 * every live Window priced would open a subscription per Window, and the venue runs dozens.
 *
 * A Window inside its no-entry buffer is out: the reserve would refuse it, so the picker never offers it.
 */
export function useShortWindows(nowMs: number): ShortWindows {
  const { venueId } = useVenue();
  const reading = useLanes(venueId);
  return useMemo(() => {
    const laneSet = reading && isOk(reading) ? reading.value : null;
    const open = (laneSet?.lanes ?? []).flatMap((lane) => lane.markets).filter((market) => nowMs > 0 && phase(market, nowMs) === "trading");
    const byAsset = new Map<TickerSymbol, EventMarket[]>();
    for (const market of open) {
      const held = byAsset.get(market.asset);
      if (held) held.push(market);
      else byAsset.set(market.asset, [market]);
    }
    const soonest = (s: ShortStock) => s.windows[0]?.expirySec ?? Number.MAX_SAFE_INTEGER;
    const stocks = [...byAsset.entries()]
      .map(([asset, windows]) => ({ asset, windows: [...windows].sort((a, b) => a.expirySec - b.expirySec) }))
      .sort((a, b) => soonest(a) - soonest(b) || a.asset.localeCompare(b.asset));
    return { stocks, loading: reading === null };
  }, [reading, nowMs]);
}
