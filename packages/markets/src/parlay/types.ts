import type { IntentJournal } from "@agari/core/ports";
import type { Address, Diagnosis, Signature } from "@agari/core/types";
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
