import type { TxOutcome } from "@agari/core/ports";
import type { Address, Signature } from "@agari/core/types";
import type { VaultDeployment, VaultGrant } from "@agari/core/vault";
import type { SponsorStatus } from "@agari/markets";
import type { CapsForm } from "./caps";

export type SessionStatus = "no-wallet" | "not-deployed" | "loading" | "disarmed" | "armed" | "grant-without-key" | "expired";

/** Everything a surface needs to describe tap-trading right now — derived, never asserted. */
export interface SessionKeyView {
  status: SessionStatus;
  owner: Address | null;
  /** This browser's key for the owner, if it holds one. */
  key: { address: Address } | null;
  /** The owner's SESSION grant as the vault has it, live or not. */
  grant: VaultGrant | null;
  deployment: VaultDeployment | null;
  decimals: number;
  nowSec: number;
  sponsor: SponsorStatus | null;
  /** The relayer's last refusal, when the key had to pay. */
  sponsorRefusal: string | null;
  /** The key's SOL for its own fees, in lamports; null while unknown. */
  keyFeeLamports: bigint | null;
  vaultAvailableBase: bigint | null;
}

export type SessionBusy = "enabling" | "revoking" | "rekeying" | null;

export interface EnableOutcome {
  outcome: TxOutcome;
  topUpHash: Signature | null;
  topUpError: string | null;
}

export interface SessionKeyActions {
  enable(form: CapsForm): Promise<EnableOutcome>;
  rekey(): Promise<EnableOutcome>;
  revoke(): Promise<TxOutcome>;
  topUp(): Promise<Signature | null>;
  forget(): Promise<void>;
}

export function isGrantLive(grant: VaultGrant | null, nowSec: number): grant is VaultGrant {
  return grant !== null && !grant.revoked && grant.expiresAtSec >= nowSec;
}

/** The one place the status is decided; every chip, sheet and note reads it from here. */
export function deriveStatus(input: {
  owner: Address | null;
  deployment: VaultDeployment | null | undefined;
  grant: VaultGrant | null | undefined;
  keyLoaded: boolean;
  key: { address: Address } | null;
  nowSec: number;
}): SessionStatus {
  if (!input.owner) return "no-wallet";
  if (input.deployment === null) return "not-deployed";
  if (input.deployment === undefined || input.grant === undefined || !input.keyLoaded) return "loading";
  const grant = input.grant;
  if (!grant || grant.revoked) return "disarmed";
  if (grant.expiresAtSec < input.nowSec) return "expired";
  // Exact match: base58 is case-sensitive (D-010).
  if (!input.key || input.key.address !== grant.actor) return "grant-without-key";
  return "armed";
}
