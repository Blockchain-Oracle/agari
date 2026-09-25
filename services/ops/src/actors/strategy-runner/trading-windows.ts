import { phase } from "@agari/core/lifecycle";
import type { EventMarket, LaneSet } from "@agari/core/types";

/**
 * Strategies trade every live Window: the stock lanes in session and the 24/7 lanes (xStocks, pre-IPO tokens,
 * baskets) around the clock. S24 limited them to stock Windows and rested them from the bell to the open; the owner
 * reversed that on 09-24 ("there are 24/7 tokens now; they should trade those"). The runner rests only when no Window
 * at all is trading: one light check every five minutes, no model call.
 */
export const REST_CHECK_MS = 5 * 60_000;

/** Every Window trading now, across every lane. */
export function tradingWindows(laneSet: LaneSet, nowMs: number): EventMarket[] {
  return laneSet.lanes.flatMap((lane) => lane.markets).filter((m) => phase(m, nowMs) === "trading");
}
