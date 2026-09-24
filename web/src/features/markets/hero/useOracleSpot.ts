"use client";

import { spotSymbolOf } from "@agari/core/market";
import type { EventMarket, MarketId } from "@agari/core/types";
import { useAssetPrice, useMarket } from "@agari/markets/react";
import { basisRaw, feedRawToOracleRaw } from "./units";

/** The part of a Window that names its spot: the ticker and the lane (a 24/7 Window follows its xStock, not the stock). */
export type SpotOf = Pick<EventMarket, "asset" | "lane">;

/**
 * The live price on the oracle's cents scale — the same number the chart plots and
 * the same basis a Window settles on.
 *
 * Separate from `useChartSeries` because a surface can want the number without the
 * series: the reel reads a price on every card but only draws the chart of the card
 * you are looking at.
 */
export function useOracleSpot(market: SpotOf | null): bigint | null {
  const price = useWindowSpotPrice(market);
  if (!price?.ok || price.value === null) return null;
  return feedRawToOracleRaw(basisRaw(price.value), price.value.decimals);
}

/** The feed's own reading of the price a Window settles on (the stock, or its xStock on the 24/7 lane). */
export function useWindowSpotPrice(market: SpotOf | null) {
  return useAssetPrice(market ? spotSymbolOf(market.asset, market.lane) : null);
}

/** The same, for a surface that holds only the Window's id (a duel card): the Window read is shared and cached. */
export function useWindowSpotPriceById(marketId: MarketId | null) {
  const market = useMarket(marketId);
  return useWindowSpotPrice(market?.ok ? market.value : null);
}
