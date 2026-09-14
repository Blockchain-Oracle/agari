/** LeverageReserve (Boost) on Solana is `agari-leverage` (S10c). Until deployed: empty reads, not-deployed quotes, refused writes. */
import { LEVERAGE_NOT_DEPLOYED, type LeverageDeployment, type LeverageIntent, type LeverageMark, type LeveragePosition, type LeverageQuote, type LeverageReserveState } from "@agari/core/leverage";
import type { IntentJournal, PhaseListener } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import type { Address, Diagnosis, MarketId, Side, Signature } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { absent, refusedFor, unavailableFor } from "../stub/product";
import type { VaultContracts } from "../vault/contracts";

export interface LeverageTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

export type LeverageOpenOutcome =
  | { status: "confirmed"; txHash: Signature; positionId: bigint; stakeBase: bigint; quantityRaw: bigint; frontedBase: bigint }
  /** The book moved: this stake now buys fewer contracts than the guard allows. Nothing was sent. */
  | { status: "requote"; stakeBase: bigint; quantityRaw: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Signature }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Signature };

export const resolveLeverageDeployment = (_env?: Partial<MarketsEnv>): LeverageDeployment | null => null;
export const getLeverageReserveState = (): Promise<Reading<LeverageReserveState | null>> => absent(null);
export const listLeveragePositionsOf = (_wallet: Address): Promise<Reading<LeveragePosition[]>> => absent([]);
export const listLeverageOpenPositions = (): Promise<Reading<LeveragePosition[]>> => absent([]);
export const getLeveragePosition = (_positionId: bigint): Promise<Reading<LeveragePosition | null>> => absent(null);
export const getLeverageSharesOf = (_wallet: Address): Promise<Reading<{ shares: bigint; worthBase: bigint }>> => absent({ shares: 0n, worthBase: 0n });
export const getLeverageMark = (_positionId: bigint): Promise<Reading<LeverageMark>> => unavailableFor(LEVERAGE_NOT_DEPLOYED);
export const previewLeverageOpen = (_marketId: MarketId, _side: Side, _quantityRaw: bigint, _leverageBps: number, _maintenanceBps: number): Promise<Reading<LeverageQuote>> =>
  unavailableFor(LEVERAGE_NOT_DEPLOYED);
export const sizeLeverageForStake = (_marketId: MarketId, _side: Side, _stakeBase: bigint, _leverageBps: number, _maintenanceBps: number): Promise<Reading<LeverageQuote>> =>
  unavailableFor(LEVERAGE_NOT_DEPLOYED);

export async function submitLeverageOpen(
  _ctx: LeverageTxContext,
  _intent: Extract<LeverageIntent, { kind: "leverage-open" }>,
  _maintenanceBps: number,
  _onPhase?: PhaseListener,
): Promise<LeverageOpenOutcome> {
  return refusedFor(LEVERAGE_NOT_DEPLOYED);
}
