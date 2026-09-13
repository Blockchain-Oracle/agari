import type { LuckyResult } from "@masayume/core/games";
import type { Address, Bytes32, Hex, Side } from "@masayume/core/types";

/**
 * What the five Lucky routes say, typed once for both ends. Money is a decimal string in base units on
 * the wire and a bigint on either side of it; nothing here is a float.
 */

export interface LuckyCommitWire {
  drawId: Bytes32;
  wallet: Address;
  commitment: Bytes32;
  nonce: number;
  policyVersion: number;
  stakeBase: string;
}

export interface LuckyWindowWire {
  marketId: Bytes32;
  asset: string;
  intervalSec: number;
  expirySec: number;
  poolAddress: Address;
  decimals: number;
}

/** The dealt quote — the server's snapshot at the reveal. The card places on the browser's LIVE one, never this. */
export interface LuckyQuoteWire {
  avgPriceBps: number;
  contractsRaw: string;
  expectedCostBase: string;
  maxCostBase: string;
  payoutIfRightBase: string;
}

export interface LuckyDealWire {
  drawId: Bytes32;
  wallet: Address;
  nonce: number;
  policyVersion: number;
  stakeBase: string;
  commitment: Bytes32;
  serverSeed: Bytes32;
  clientSeed: Bytes32;
  /** The policy's universes, so the browser's check replays the same mapping. */
  assets: readonly string[];
  multipliers: readonly number[];
  draw: { asset: string; side: Side; multiplier: number };
  candidateHash: Bytes32;
  candidateCount: number;
  window: LuckyWindowWire | null;
  quote: LuckyQuoteWire | null;
  /** The other side's price on the same Window at the same stake, when the book had one. */
  otherSideBps: number | null;
  result: "drawn" | "refused";
  refusal: string | null;
}

/** A deal the scan actually made: the Window and the dealt quote are present, by type. */
export type DealtLuckyWire = LuckyDealWire & { window: LuckyWindowWire; quote: LuckyQuoteWire; result: "drawn" };

export function isDealt(deal: LuckyDealWire): deal is DealtLuckyWire {
  return deal.result === "drawn" && deal.window !== null && deal.quote !== null;
}

/** What the Ticket lane came back as, reported by the browser; only `confirmed` is checked against the tape. */
export type LuckyPlacedStatus = "confirmed" | "nothingFilled" | "refused" | "reverted" | "unknown" | "declined";

export interface LuckyPlacedWire {
  result: LuckyResult;
  refusal: string | null;
  txHash: Hex | null;
  costBase: string | null;
  quantityRaw: string | null;
}

export interface LuckyRowWire {
  drawId: Bytes32;
  nonce: number;
  asset: string | null;
  side: Side | null;
  multiplier: number | null;
  marketId: Bytes32 | null;
  quoteAvgPriceBps: number | null;
  txHash: Hex | null;
  stakeBase: string;
  costBase: string | null;
  quantityRaw: string | null;
  result: LuckyResult;
  refusal: string | null;
  createdAtMs: number;
  settledAtMs: number | null;
}

export interface LuckyHistoryWire {
  configured: boolean;
  rows: LuckyRowWire[];
  streak: number;
  best: number;
}

export interface LuckyBoardRowWire {
  wallet: Address;
  streak: number;
  best: number;
  spins: number;
}

export interface LuckyBoardWire {
  configured: boolean;
  rows: LuckyBoardRowWire[];
}
