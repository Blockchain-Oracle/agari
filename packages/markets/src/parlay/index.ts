/** ParlayReserve on Solana is `agari-parlay` (S10). Until it is deployed every read answers "not deployed" and writes refuse. */
import { PARLAY_NOT_DEPLOYED, type ParlayDeployment, type ParlayIntent, type ParlayLegInput, type ParlayMode, type ParlayParams, type ParlayQuote, type ParlayReserveState, type ParlayTicket } from "@agari/core/parlay";
import type { IntentJournal, PhaseListener } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import type { Address, Diagnosis, Signature } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { absent, refusedFor, unavailableFor } from "../stub/product";
import type { VaultContracts } from "../vault/contracts";

export interface ParlayTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

export type ParlayOpenOutcome =
  | { status: "confirmed"; txHash: Signature; parlayId: bigint; stakeBase: bigint }
  /** The book moved: the stake this payout now needs is above the one confirmed. Nothing was sent. */
  | { status: "requote"; stakeBase: bigint; maxPayoutBase: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Signature }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Signature };

export const resolveParlayDeployment = (_env?: Partial<MarketsEnv>): ParlayDeployment | null => null;
export const getParlayReserveState = (): Promise<Reading<ParlayReserveState | null>> => absent(null);
export const listParlaysOf = (_wallet: Address): Promise<Reading<ParlayTicket[]>> => absent([]);
export const getParlay = (_parlayId: bigint): Promise<Reading<ParlayTicket | null>> => absent(null);
export const getParlaySharesOf = (_wallet: Address): Promise<Reading<{ shares: bigint; worthBase: bigint }>> => absent({ shares: 0n, worthBase: 0n });
export const quoteParlayOnchain = (_legs: readonly ParlayLegInput[], _mode: ParlayMode, _params: ParlayParams): Promise<Reading<ParlayQuote>> => unavailableFor(PARLAY_NOT_DEPLOYED);

export async function submitParlayOpen(_ctx: ParlayTxContext, _intent: Extract<ParlayIntent, { kind: "parlay-open" }>, _onPhase?: PhaseListener): Promise<ParlayOpenOutcome> {
  return refusedFor(PARLAY_NOT_DEPLOYED);
}
