import { phase } from "@agari/core/lifecycle";
import type { EventMarket, LaneSet } from "@agari/core/types";

/**
 * Strategies trade stock Windows (S24): the studio publishes them over "every listed stock", so the 24/7 PreStocks
 * and basket lanes are not theirs. While no stock Window trades the runner rests: one light check every five
 * minutes, no model call, and a heartbeat that says so, instead of a full scan every thirty seconds all night.
 */
export const REST_CHECK_MS = 5 * 60_000;

export const isStockWindow = (m: EventMarket): boolean => m.lane !== "token";

/** The stock Windows trading now, across every lane. */
export function tradingStockWindows(laneSet: LaneSet, nowMs: number): EventMarket[] {
  return laneSet.lanes.flatMap((lane) => lane.markets).filter((m) => isStockWindow(m) && phase(m, nowMs) === "trading");
}
