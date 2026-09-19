/** RangeReserve on Solana is `agari-range` (S10). Reads that need the program answer "not deployed"; the rest are empty. */
import { multiplierMilli, RANGE_NOT_DEPLOYED, type RangeBasis, type RangeDeployment, type RangeIntent, type RangeMode, type RangeParams, type RangeQuote, type RangeReserveState, type RangeRound, type RangeSide } from "@agari/core/range";
import type { IntentJournal, PhaseListener } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import type { TickerSymbol } from "@agari/core/market";
import type { Address, Diagnosis, MarketId, Signature } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { nowMs } from "../provider/clock";
import { absent, refusedFor, unavailableFor } from "../stub/product";
import type { VaultContracts } from "../vault/contracts";
import { rangeProgramId } from "./deployment";

/** What the pricing reads off the Window: the opening print, where the book sits, the house's σ. */
export interface RangeWindowBasis {
  openingPrint: bigint;
  centerQE6: bigint;
  sigmaE8: bigint;
}

export interface RangePreview {
  stakeBase: bigint;
  probRaw: bigint;
  openingPrint: bigint;
  basis: RangeBasis;
}

export interface RangeBand {
  marketId: MarketId;
  asset: TickerSymbol;
  side: RangeSide;
  lowPrint: bigint;
  highPrint: bigint;
}

export interface RangeTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

export type RangeOpenOutcome =
  | { status: "confirmed"; txHash: Signature; roundId: bigint; stakeBase: bigint }
  /** The basis moved: the stake this payout now needs is above the one confirmed. Nothing was sent. */
  | { status: "requote"; stakeBase: bigint; maxPayoutBase: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Signature }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Signature };

/** The reserve's address on this cluster, or null where `agari-range` is not deployed. */
export function resolveRangeDeployment(_env?: Partial<MarketsEnv>): RangeDeployment | null {
  const program = rangeProgramId();
  return program ? { chainId: 0, rangeReserve: program, fromBlock: 0n } : null;
}

export { getRange, getRangeReserveState, getRangeSharesOf, listRangesOf } from "./reads";
export { previewRangeBasis, previewRangeOpen, quoteRangeOnchain, readRangeCapacity } from "./reads";

/** The program's preview as the one quote shape every ticket reads. */
export function toRangeQuote(preview: RangePreview, side: RangeSide, maxPayoutBase: bigint, one: bigint, decimals: number): RangeQuote {
  return {
    side,
    insideProbE6: side === "inside" ? (preview.probRaw * 1_000_000n) / one : 1_000_000n - (preview.probRaw * 1_000_000n) / one,
    probRaw: preview.probRaw,
    stakeBase: preview.stakeBase,
    maxPayoutBase,
    multiplierMilli: multiplierMilli(maxPayoutBase, preview.stakeBase),
    decimals,
    quotedAtMs: nowMs(),
  };
}

export async function submitRangeOpen(_ctx: RangeTxContext, _intent: Extract<RangeIntent, { kind: "range-open" }>, _onPhase?: PhaseListener): Promise<RangeOpenOutcome> {
  return refusedFor(RANGE_NOT_DEPLOYED);
}
