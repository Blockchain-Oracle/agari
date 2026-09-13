"use client";

import { isOk } from "@masayume/core/schemas";
import { useLanes } from "@masayume/markets/react";
import { useMemo } from "react";
import { useVenue } from "@/features/markets/useVenue";
import { Ticker } from "./Ticker";
import { TICKER_SLOTS, useTickerPrices } from "./useTickerPrices";

/** Feeds the strip from the assets that actually have live Windows; an empty venue renders an empty strip, never invented numbers. */
export function LiveTicker() {
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const assets = useMemo(() => {
    if (!lanes || !isOk(lanes)) return [];
    const seen = new Set<string>();
    for (const lane of lanes.value.lanes) for (const market of lane.markets) seen.add(market.asset);
    return [...seen].sort().slice(0, TICKER_SLOTS);
  }, [lanes]);
  const entries = useTickerPrices(assets);
  return <Ticker entries={entries} />;
}
