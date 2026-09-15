/**
 * The Gap lane's quotes (session-lanes.md §1.5): Friday 16:00 → Sunday 19:59 ET, the `fair.ts` z-score against the xStock
 * weekend spot for TSLA/NVDA/QQQ and 500 ticks wide elsewhere, capped at `MM_GAP_MAX_CASH`. Lane 6a owns this file; the
 * foundation stub pulls.
 */
import type { LaneQuote, LaneQuoteInput } from "./lane-quote";

export function gapQuote(_input: LaneQuoteInput): LaneQuote {
  return { phase: "pull", fairTicks: null, maxCashPerWindow: 0n, why: "lane not built" };
}
