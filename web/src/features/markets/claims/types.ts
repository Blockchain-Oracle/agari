import type { Address, ClaimKind, Diagnosis, Hex, MarketId, OutcomeIdx } from "@masayume/core/types";

/** One redemption = one leg = one wallet signature; a void row contributes two items (canon #11). */
export type ClaimItemStatus = "pending" | "claiming" | "confirmed" | "reverted" | "unknown";

export interface ClaimItem {
  key: string;
  marketId: MarketId;
  marketAddress: Address;
  kind: ClaimKind;
  asset: string;
  intervalSec: number;
  outcomeIdx: OutcomeIdx;
  amountRaw: bigint;
  payoutBase: bigint;
  decimals: number;
  status: ClaimItemStatus;
  txHash: Hex | null;
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
