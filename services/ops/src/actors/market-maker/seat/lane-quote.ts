/**
 * The seed maker's lane hook (session-lanes.md §1.5, §2.4): a Gap or token Window gets its phase, fair and cash cap from
 * its lane (`gap-fair.ts` 6a, `token-fair.ts` 6b) instead of the in-session spot-vs-open model; `tendWindow` does the rest.
 */
import type { SessionStatus, TickerSymbol } from "@agari/core/market";
import type { HaltBoard, LaneBasis } from "@agari/core/types";
import type { MarketView, SeriesView } from "@agari/markets/ops";
import type { SpotFeed } from "../../../prices/spot";
import type { SeatMakerEnv } from "./env";
import { gapQuote } from "./gap-fair";
import type { MakerPhase } from "./quote";
import { tokenQuote } from "./token-fair";

export interface LaneQuoteInput {
  series: SeriesView;
  market: MarketView;
  symbol: TickerSymbol;
  nowSec: number;
  status: SessionStatus | null;
  spot: SpotFeed | null;
  halts: HaltBoard;
  env: SeatMakerEnv;
}

export interface LaneQuote {
  phase: MakerPhase;
  /** YES ticks; null when the lane has no fair yet (nothing is quoted). */
  fairTicks: number | null;
  /** Base units (6 dp): both sides' escrow on this Window. */
  maxCashPerWindow: bigint;
  /** Half-spread in YES ticks when the lane wants its own (a blind Gap quote goes wide); absent = `MM_HALF_SPREAD_TICKS`. */
  halfSpreadTicks?: number;
  /** Why, for the maker's heartbeat. */
  why: string;
}

/** Null for a Regular Window: `tendWindow` keeps its own session model. */
export function laneQuote(basis: LaneBasis, input: LaneQuoteInput): LaneQuote | null {
  if (basis === "gap") return gapQuote(input);
  if (basis === "token") return tokenQuote(input);
  return null;
}
