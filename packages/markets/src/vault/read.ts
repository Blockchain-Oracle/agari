import { VAULT_NOT_DEPLOYED, type VaultDeployment, type VaultGrant, type VaultHoldings, type VaultSnapshot } from "@agari/core/vault";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId, Side, Signature } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { getVaultHoldings as portVaultHoldings, getVaultSnapshot as portVaultSnapshot } from "../provider/reads";
import { notDeployedError } from "../stub/not-deployed";

/** The EventVault for the configured cluster, or null until `agari-vault` is deployed (S7). */
export function resolveVaultDeployment(_env?: Partial<MarketsEnv>): VaultDeployment | null {
  return null;
}

export const getVaultSnapshot = (wallet: Address): Promise<Reading<VaultSnapshot | null>> => portVaultSnapshot(wallet);
export const getVaultHoldings: typeof portVaultHoldings = (wallet, onchain) => portVaultHoldings(wallet, onchain);

/** One grant as the vault records it. A plain promise (the runner's contract), so it throws the not-deployed reading. */
export async function getVaultGrant(_grantId: bigint): Promise<VaultGrant> {
  throw notDeployedError(VAULT_NOT_DEPLOYED);
}

export type RecoveredVaultExecution =
  | { status: "unknown" }
  | { status: "reverted"; txHash: Signature }
  | { status: "confirmed"; txHash: Signature; cashDelta: bigint; tokenDelta: bigint; atSec: number; side: Side };

/** What an actor captured before sending a grant-scoped vault order, to find it again after a lost reply. */
export interface VaultExecutionEvidence {
  owner: Address;
  actor: Address;
  marketId: MarketId;
  grantId: bigint;
  side: Side;
  /** The slot the send started from; the program's `Executed` events are searched from here. */
  fromSlot: bigint;
  txHash: Signature | null;
}

/** Without a vault there is nothing to recover, so the answer is "unknown" and the caller keeps waiting (AD-3). */
export async function recoverVaultExecution(_input: VaultExecutionEvidence): Promise<RecoveredVaultExecution> {
  return { status: "unknown" };
}
