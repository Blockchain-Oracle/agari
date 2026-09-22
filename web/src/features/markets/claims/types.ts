import type { Address, ClaimKind, ClaimLeg, Diagnosis, MarketId, OutcomeIdx, Signature } from "@agari/core/types";

/**
 * One redemption = one Window = one wallet signature. `user_redeem` pays a seat in full (partial redeem is
 * PROGRAM-only, engine §8.4), so a void Window's two legs settle in the same transaction and are one item
 * (first-call.md §6); Masayume redeemed per outcome token, one item per leg.
 */
export type ClaimItemStatus =
  | "pending"
  | "claiming"
  | "confirmed"
  /** The venue's crank (D-032) paid this seat before the wallet's own redeem could: the money is in the wallet, unsigned by it. */
  | "paid"
  | "reverted"
  | "unknown";

export interface ClaimItem {
  key: string;
  marketId: MarketId;
  marketAddress: Address;
  kind: ClaimKind;
  asset: string;
  intervalSec: number;
  /** Every paying leg the one signature redeems, in the row's order. */
  legs: readonly ClaimLeg[];
  /** The first leg's outcome and contracts: informational on a full redeem, carried for the port's request shape. */
  outcomeIdx: OutcomeIdx;
  amountRaw: bigint;
  /** The legs' payouts together. */
  payoutBase: bigint;
  decimals: number;
  status: ClaimItemStatus;
  txHash: Signature | null;
  /** Why this item did not confirm — kept per item, never collapsed into one verdict (AD-15). */
  diagnosis: Diagnosis | null;
}

export type ClaimRunStatus = "idle" | "running" | "done";

export interface ClaimRun {
  status: ClaimRunStatus;
  items: ClaimItem[];
  /** Why the run stopped early: gas short before any popup, a chain read failing, or the user cancelling. */
  diagnosis: Diagnosis | null;
  gasShort: boolean;
  finishedAtMs: number | null;
}
