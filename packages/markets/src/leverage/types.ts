import type { Diagnosis, Signature } from "@agari/core/types";

export type LeverageOpenOutcome =
  | { status: "confirmed"; txHash: Signature; positionId: bigint; stakeBase: bigint; quantityRaw: bigint; frontedBase: bigint }
  /** The book moved: this stake now buys fewer contracts than the guard allows. Nothing was sent. */
  | { status: "requote"; stakeBase: bigint; quantityRaw: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Signature }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Signature };
