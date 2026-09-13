"use client";

import { phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import type { EventMarket, MarketId } from "@masayume/core/types";
import { useLanes } from "@masayume/markets/react";
import { useMemo } from "react";
import { useVenue } from "../markets/useVenue";

export interface RangeWindows {
  /** Every Window a band may sit on right now: Trading, a minute or more left, soonest first. */
  windows: EventMarket[];
  byId: Map<MarketId, EventMarket>;
  loading: boolean;
}

/** The reserve's own entry rule (`minTimeLeftSec`), applied before the picker offers a Window. */
export function useRangeWindows(nowMs: number, minTimeLeftSec: number): RangeWindows {
  const { venueId } = useVenue();
  const reading = useLanes(venueId);
  return useMemo(() => {
    const laneSet = reading && isOk(reading) ? reading.value : null;
    const nowSec = Math.floor(nowMs / 1000);
    const windows = (laneSet?.lanes ?? [])
      .flatMap((lane) => lane.markets)
      .filter((market) => nowMs > 0 && phase(market, nowMs) === "trading" && market.expirySec - nowSec >= minTimeLeftSec)
      .sort((a, b) => a.expirySec - b.expirySec);
    return { windows, byId: new Map(windows.map((market) => [market.marketId, market])), loading: reading === null };
  }, [reading, nowMs, minTimeLeftSec]);
}
