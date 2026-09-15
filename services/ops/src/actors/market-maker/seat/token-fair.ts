/**
 * The token lane's quotes (session-lanes.md §2.4): 24/7 around the xStock spot, capped at `MM_TOKEN_MAX_CASH_PER_WINDOW`.
 * Lane 6b owns this file; the foundation stub pulls.
 */
import type { LaneQuote, LaneQuoteInput } from "./lane-quote";

export function tokenQuote(_input: LaneQuoteInput): LaneQuote {
  return { phase: "pull", fairTicks: null, maxCashPerWindow: 0n, why: "lane not built" };
}
