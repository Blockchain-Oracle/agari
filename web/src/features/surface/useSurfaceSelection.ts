"use client";

import { isOk, type Reading } from "@masayume/core/schemas";
import type { Bytes32, EventMarket, Lane, LaneSet, MarketId } from "@masayume/core/types";
import { useLanes } from "@masayume/markets/react";
import { useCallback, useMemo, useState } from "react";

export interface SurfaceSelection {
  reading: Reading<LaneSet> | null;
  lanes: readonly Lane[];
  /** Assets present in the live lane set, in the order their soonest Window closes. */
  assets: string[];
  asset: string | null;
  setAsset: (asset: string) => void;
  /** Every live Window of the asset, nearest close first — the term structure's x-axis. */
  windows: EventMarket[];
  /** The Window the book sections read. */
  focal: EventMarket | null;
  setFocal: (marketId: MarketId) => void;
}

/**
 * The reference's selection (`SurfacePage` L96–120): the asset defaults to that of the
 * soonest-expiring market, the focal Window resets to the nearest when the asset changes.
 * Kept by market id rather than index, so when the focal Window closes and leaves the lane
 * set the surface falls to the next one instead of pointing at a different Window by accident.
 */
export function useSurfaceSelection(venueId: Bytes32 | null): SurfaceSelection {
  const reading = useLanes(venueId);
  const laneSet = reading && isOk(reading) ? reading.value : null;
  const lanes = laneSet?.lanes ?? [];

  const all = useMemo(() => lanes.flatMap((lane) => lane.markets).sort((a, b) => a.expirySec - b.expirySec), [lanes]);
  const assets = useMemo(() => [...new Set(all.map((market) => market.asset))], [all]);

  const [chosenAsset, setChosenAsset] = useState<string | null>(null);
  const asset = chosenAsset !== null && assets.includes(chosenAsset) ? chosenAsset : (assets[0] ?? null);
  const windows = useMemo(() => all.filter((market) => market.asset === asset), [all, asset]);

  const [chosenId, setChosenId] = useState<MarketId | null>(null);
  const focal = windows.find((market) => market.marketId === chosenId) ?? windows[0] ?? null;

  const setAsset = useCallback((next: string) => {
    setChosenAsset(next);
    setChosenId(null);
  }, []);

  return { reading, lanes, assets, asset, setAsset, windows, focal, setFocal: setChosenId };
}
