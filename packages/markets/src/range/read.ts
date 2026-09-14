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

export const resolveRangeDeployment = (_env?: Partial<MarketsEnv>): RangeDeployment | null => null;
export const getRangeReserveState = (): Promise<Reading<RangeReserveState | null>> => absent(null);
export const listRangesOf = (_wallet: Address): Promise<Reading<RangeRound[]>> => absent([]);
export const getRange = (_roundId: bigint): Promise<Reading<RangeRound | null>> => absent(null);
export const getRangeSharesOf = (_wallet: Address): Promise<Reading<{ shares: bigint; worthBase: bigint }>> => absent({ shares: 0n, worthBase: 0n });
export const previewRangeBasis = (_marketId: MarketId, _asset: TickerSymbol): Promise<Reading<RangeWindowBasis>> => unavailableFor(RANGE_NOT_DEPLOYED);
export const previewRangeOpen = (_band: RangeBand, _maxPayoutBase: bigint): Promise<Reading<RangePreview>> => unavailableFor(RANGE_NOT_DEPLOYED);
export const quoteRangeOnchain = (_band: RangeBand, _mode: RangeMode, _params: RangeParams, _tauSec: number): Promise<Reading<RangeQuote>> => unavailableFor(RANGE_NOT_DEPLOYED);

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
