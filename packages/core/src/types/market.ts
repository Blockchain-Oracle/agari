import type { MarketId } from "./ids";
import type { Address } from "./primitives";

export { toMarketId, type MarketId } from "./ids";

export type Side = "up" | "down";
export type OutcomeIdx = 0 | 1;

export const SIDE_TO_OUTCOME: Record<Side, OutcomeIdx> = { up: 0, down: 1 };
export const OUTCOME_TO_SIDE: Record<OutcomeIdx, Side> = { 0: "up", 1: "down" };

/** Indexer lifecycle status — event-derived, so it lags the timestamp-implicit transitions (canon #1). */
export type IndexedStatus = "Listed" | "Trading" | "Locked" | "Settling" | "Resolved" | "Voided" | "Finalized";

export interface EventMarket {
  marketId: MarketId;
  venueId: Address | null;
  asset: string;
  question: string;
  intervalSec: number;
  strikeRaw: bigint;
  /** strike 0 = "close at or above open"; fixed-strike markets are excluded from v1 lanes (FR-6). */
  isUpDown: boolean;
  tradingStartSec: number;
  expirySec: number;
  /** Recycled across windows — a display detail, never a key. */
  poolAddress: Address;
  marketAddress: Address;
  nonce: bigint | null;
  yesTokenId: bigint;
  noTokenId: bigint;
  collateral: Address;
  decimals: number;
  status: IndexedStatus;
  winningOutcome: OutcomeIdx | null;
  voided: boolean;
  finalized: boolean | null;
  openingPriceRaw: bigint | null;
  oracleQuestionId: string | null;
  volumeQuoteRaw: bigint;
  tradeCount: number;
  lastPriceRaw: bigint | null;
  resolvedAtMs: number | null;
}

/** Head-fresh chain view of one market; the only source that may gate a write (canon #1). */
export interface OnchainSnapshot {
  marketId: MarketId;
  marketAddress: Address;
  outcomeToken: Address;
  yesId: bigint;
  noId: bigint;
  pool: Address;
  nonce: bigint;
  collateral: Address;
  status: number;
  backing: bigint;
  finalized: boolean;
  expirySec: number;
  decimals: number;
  winningOutcome: OutcomeIdx | null;
  isResolved: boolean;
  isVoided: boolean;
}

export interface Lane {
  intervalSec: number;
  label: string;
  markets: EventMarket[];
  /** Estimated next window start when the lane is between rounds; null when unknown. */
  nextStartSec: number | null;
}

export interface LaneSet {
  venueId: Address;
  lanes: Lane[];
  excludedFixedStrike: number;
}
