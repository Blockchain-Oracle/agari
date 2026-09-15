import type { MarketId, OutcomeIdx, Side } from "./market";
import type { Address } from "./primitives";

export interface BookLevelView {
  priceRaw: bigint;
  priceBps: number;
  quantityRaw: bigint;
}

/** Order book in UP/DOWN terms. Prices are in each side's own terms so both columns read as "what you pay". */
export interface BookDepth {
  upBids: BookLevelView[];
  upAsks: BookLevelView[];
  downBids: BookLevelView[];
  downAsks: BookLevelView[];
  decimals: number;
}

export interface BookParams {
  tickSizeRaw: bigint;
  lotSizeRaw: bigint;
  minQuantityRaw: bigint;
}

export interface Quote {
  side: Side;
  stakeBase: bigint;
  contractsRaw: bigint;
  /** What the book would charge right now for the whole size. */
  expectedCostBase: bigint;
  /** Escrow locked at the protective limit — the most a fill can ever cost. */
  maxCostBase: bigint;
  /** Protective limit in UP (YES) terms, ready for the order lane. */
  limitPriceRaw: bigint;
  avgPriceBps: number;
  oddsCents: number;
  payoutIfRightBase: bigint;
  /** How much of the stake the book can actually fill; equals `stakeBase` when not partial. */
  fillableStakeBase: bigint;
  partial: boolean;
  feeBps: number;
  decimals: number;
  quotedAtMs: number;
}

/**
 * A plain cash-out's quote (L-35): selling `contractsRaw` of one side into the live Book as it stands. Up sells into
 * the YES bids; Down sells into the YES asks, inverted (tap-trading.md §1.4).
 */
export interface ExitQuote {
  /** What the Book fills now: `min(held, fillable)`. */
  contractsRaw: bigint;
  /** Protective sell limit in UP (YES) terms, ready for the order lane: the last level reached, padded down. */
  limitPriceRaw: bigint;
  /** What the walk pays out for the whole size. */
  expectedProceedsBase: bigint;
  /** The floor at the protective limit: the least a fill can pay. */
  minProceedsBase: bigint;
  avgPriceBps: number;
}

export interface OpenPosition {
  marketId: MarketId;
  asset: string;
  intervalSec: number;
  expirySec: number;
  decimals: number;
  balanceUpRaw: bigint;
  balanceDownRaw: bigint;
  costBasisBase: bigint;
  avgCostRaw: bigint;
  markValueBase: bigint;
  unrealizedPnlBase: bigint;
  realizedPnlBase: bigint;
}

export interface Holdings {
  upRaw: bigint;
  downRaw: bigint;
}

export type ClaimKind = "win" | "void" | "vault-credit";

export interface ClaimLeg {
  outcomeIdx: OutcomeIdx;
  amountRaw: bigint;
  payoutBase: bigint;
}

export interface ClaimableRow {
  kind: ClaimKind;
  marketId: MarketId;
  marketAddress: Address;
  asset: string;
  intervalSec: number;
  expirySec: number;
  legs: ClaimLeg[];
  netPayoutBase: bigint;
  feeBps: number;
  decimals: number;
  settledAtMs: number | null;
}

/** Cash credited to the wallet's seat in one Window's Ledger (fills, refunds, evictions), withdrawable any time. */
export interface VenueCredit {
  marketId: MarketId;
  amountBase: bigint;
}

export interface BalanceSheet {
  decimals: number;
  spendableBase: bigint;
  nativeLamports: bigint;
  orderEscrowBase: bigint;
  venueCreditBase: bigint;
  venueCreditByMarket: VenueCredit[];
  /** null until the EventVault exists (Epic 6). */
  vaultBase: bigint | null;
}

export type VerdictOutcome = "win" | "loss" | "void";

export interface Verdict {
  marketId: MarketId;
  outcome: VerdictOutcome;
  /** Payout − cost basis when the entry cost is on record; otherwise the payout alone (see `costBasisBase`). */
  pnlBase: bigint;
  payoutBase: bigint;
  /** null when no entry cost is on record — the figure then reads as a payout, not a P&L. */
  costBasisBase: bigint | null;
  /** Every side the wallet held, a losing leg included at payout 0 — one card, both legs (FR-10). */
  legs: ClaimLeg[];
  feeBps: number;
  decimals: number;
  settledAtMs: number | null;
}
