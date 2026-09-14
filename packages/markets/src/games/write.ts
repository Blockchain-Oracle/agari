import { ARENA_NOT_DEPLOYED, type ArenaIntent } from "@agari/core/games";
import type { IntentJournal, PhaseListener } from "@agari/core/ports";
import type { Address, Diagnosis, Signature } from "@agari/core/types";
import { notDeployedError } from "../stub/not-deployed";
import { refusedFor } from "../stub/product";
import type { Sent, VaultContracts } from "../vault/contracts";

export interface ArenaTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

/** What one confirmed pick actually did, straight off the arena's own fill event. */
export type ArenaPickOutcome =
  | { status: "confirmed"; txHash: Signature; quantity: bigint; costBase: bigint; refundBase: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Signature }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Signature };

/** One arena instruction from a session (the settler's lock/settle/finalize cranks). A plain promise: throws until S12. */
export async function sendArenaIntent(_contracts: VaultContracts, _intent: ArenaIntent): Promise<Sent> {
  throw notDeployedError(ARENA_NOT_DEPLOYED);
}

export async function submitArenaPick(
  _ctx: ArenaTxContext,
  _intent: Extract<ArenaIntent, { kind: "arena-pick" | "arena-pick-for" }>,
  _onPhase?: PhaseListener,
): Promise<ArenaPickOutcome> {
  return refusedFor(ARENA_NOT_DEPLOYED);
}

export interface DistributeSeasonInput {
  /** The season admin role's 64-byte Solana keypair. */
  secretKey: Uint8Array;
  winners: readonly Address[];
  amountsBase: readonly bigint[];
}

/** The admin's one write: pay the winners and lock the pool (S12). */
export async function distributeSeasonPrizes(_input: DistributeSeasonInput): Promise<Signature> {
  throw notDeployedError("the season prize pool is not deployed on this cluster yet (S12)");
}
