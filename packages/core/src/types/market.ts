import type { TickerSymbol } from "../market/tickers";
import type { MarketId } from "./ids";
import type { Address } from "./primitives";

export { toMarketId, type MarketId } from "./ids";

export type Side = "up" | "down";
export type OutcomeIdx = 0 | 1;

export const SIDE_TO_OUTCOME: Record<Side, OutcomeIdx> = { up: 0, down: 1 };
export const OUTCOME_TO_SIDE: Record<OutcomeIdx, Side> = { 0: "up", 1: "down" };

/** Indexer lifecycle status — event-derived, so it lags the timestamp-implicit transitions (canon #1). */
export type IndexedStatus = "Listed" | "Trading" | "Locked" | "Settling" | "Resolved" | "Voided" | "Finalized";

/**
 * A Series' basis (the `basis: u8` seed in agari-events):
 * - `regular`: in-session Windows on the ET clock, signed stock prints at exact T;
 * - `gap`: one "Monday Gap" per weekend, Friday close → next session open;
 * - `token`: 24/7 Windows on the xStock token price.
 */
export type LaneBasis = "regular" | "gap" | "token";

/** The `basis: u8` seed → `LaneBasis` (the index is the seed); null for a basis this build doesn't know. */
export const LANE_BASES: readonly LaneBasis[] = ["regular", "gap", "token"];
export const laneBasisOf = (basis: number): LaneBasis | null => LANE_BASES[basis] ?? null;

/** The Gap lane's nominal cadence (its `cadence: u32` seed): one Window a week. The Window's own span varies with holidays. */
export const GAP_CADENCE_SEC = 604_800;

/** Which signed source recorded a print (plan PD-1). Every verdict names it. */
export type PrintSource = "pyth" | "redstone" | "switchboard" | "attested";

/** Why a Window voided at 0.5/0.5 instead of paying Up or Down (stored in `MarketResult`). */
export type VoidReason = "missing-print" | "cross-check-divergence";

/** One Window: the `Market` PDA, its Series and the recycled Book it trades on. */
export interface EventMarket {
  marketId: MarketId;
  /** The agari-events `GlobalConfig` the Window belongs to. */
  venueId: Address | null;
  asset: TickerSymbol;
  lane: LaneBasis;
  question: string;
  /** The Series cadence: 300 / 900 / 3,600, or `GAP_CADENCE_SEC` on the Gap lane. */
  intervalSec: number;
  tradingStartSec: number;
  /** Trading stops here (`lock_at`): equal to `expirySec` except on the Gap lane, which locks Sunday 20:00 ET. */
  lockAtSec: number;
  /** The closing print's boundary T. */
  expirySec: number;
  /** The recycled Book account — a display detail, never a key. */
  poolAddress: Address;
  /** The Market PDA; always equal to `marketId`. */
  marketAddress: Address;
  seriesAddress: Address;
  /** The Window's index within its Series. */
  nonce: bigint | null;
  /** The frozen price-policy version both prints must come from (PD-1). */
  policyVersion: number;
  /** The policy's primary source, known at listing. */
  printSource: PrintSource;
  collateral: Address;
  decimals: number;
  status: IndexedStatus;
  winningOutcome: OutcomeIdx | null;
  voided: boolean;
  voidReason: VoidReason | null;
  finalized: boolean | null;
  /** The opening print normalized to `PRINT_EXPO` (× 10⁻⁸); null until recorded. */
  openingPriceRaw: bigint | null;
  volumeQuoteRaw: bigint;
  tradeCount: number;
  lastPriceRaw: bigint | null;
  resolvedAtMs: number | null;
}

/** Head-fresh chain view of one market; the only source that may gate a write (canon #1). */
export interface OnchainSnapshot {
  marketId: MarketId;
  marketAddress: Address;
  pool: Address;
  ledger: Address;
  nonce: bigint;
  collateral: Address;
  status: number;
  /** Complete pairs in existence: ΣYES == ΣNO == backing. */
  backing: bigint;
  finalized: boolean;
  lockAtSec: number;
  expirySec: number;
  decimals: number;
  winningOutcome: OutcomeIdx | null;
  isResolved: boolean;
  isVoided: boolean;
}

export interface Lane {
  basis: LaneBasis;
  intervalSec: number;
  label: string;
  markets: EventMarket[];
  /** Estimated next window start when the lane is between rounds; null when unknown. */
  nextStartSec: number | null;
}

export interface LaneSet {
  venueId: Address;
  lanes: Lane[];
}
