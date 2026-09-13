"use client";

import { useAssetPrice } from "@masayume/markets/react";
import { basisRaw, feedRawToOracleRaw } from "./units";

/**
 * The live price on the oracle's cents scale — the same number the chart plots and
 * the same basis a Window settles on.
 *
 * Separate from `useChartSeries` because a surface can want the number without the
 * series: the reel reads a price on every card but only draws the chart of the card
 * you are looking at.
 */
export function useOracleSpot(asset: string | null): bigint | null {
  const price = useAssetPrice(asset);
  if (!price?.ok || price.value === null) return null;
  return feedRawToOracleRaw(basisRaw(price.value), price.value.decimals);
}
