import type { IntentJournal, PhaseListener } from "@agari/core/ports";
import type { Address, Signature } from "@agari/core/types";
import type { TransactionSigner } from "@solana/kit";
import { diagnose } from "../errors/error-map";
import type { ChainFailure } from "./errors";
import { describeChainFailure, SimulationFailedError } from "./errors";
import type { WriteEvidence } from "./evidence";
import { confirmStep } from "./steps/confirm";
import type { BuiltWrite, WriteRpc } from "./steps/message";
import { sendStep } from "./steps/send";
import { signStep } from "./steps/sign";

/** Everything a write lane needs, bound to one session. */
export interface WriteContext {
  wallet: Address;
  signer: TransactionSigner;
  rpc: WriteRpc;
  journal: IntentJournal;
  evidence: WriteEvidence;
  nowMs: () => number;
  /** The confirm loop's cap; tests and drives shorten it. */
  confirmCapMs?: number;
}

export type Settled =
  /** Never broadcast: the wallet refused, or preflight did. The journal record is already failed. */
  | { kind: "not-sent"; error: unknown }
  | { kind: "landed"; signature: Signature }
  | { kind: "landed-failed"; signature: Signature; failure: ChainFailure }
  /** No answer by expiry or the cap. The record is `unknown`; recovery decides, nothing is re-signed (AD-3). */
  | { kind: "unknown"; signature: Signature; reason: "expired" | "cap" };

/**
 * Sign → journal the signature with its last valid block height → send → confirm (first-call.md §3.1, §3.4). The
 * signature is journaled before the bytes leave, so a tab killed mid-send is reconciled by signature on return.
 * A sending-only wallet has already broadcast when it returns, so its record is written then.
 */
export async function signSendConfirm(ctx: WriteContext, recordId: string, built: BuiltWrite, onPhase?: PhaseListener): Promise<Settled> {
  let signed: Awaited<ReturnType<typeof signStep>>;
  try {
    signed = await signStep(ctx.rpc, ctx.signer, built);
  } catch (error) {
    await ctx.journal.markFailed(recordId, diagnose(error).technical);
    return { kind: "not-sent", error };
  }
  const { signature } = signed;
  await ctx.journal.markSent(recordId, signature, Number(signed.lastValidBlockHeight));
  if (signed.mode === "sign") {
    try {
      await sendStep(ctx.rpc, signed.wire);
    } catch (error) {
      const reason = error instanceof SimulationFailedError ? `preflight refused, never broadcast: ${describeChainFailure(error.failure)}` : diagnose(error).technical;
      await ctx.journal.markFailed(recordId, reason);
      return { kind: "not-sent", error };
    }
  }
  onPhase?.("confirming", { txHash: signature });

  const landing = await confirmStep(ctx.rpc, {
    signature,
    ...(signed.mode === "sign" ? { wire: signed.wire } : {}),
    lastValidBlockHeight: signed.lastValidBlockHeight,
    ...(ctx.confirmCapMs === undefined ? {} : { capMs: ctx.confirmCapMs }),
  });
  if (landing.kind === "unknown") {
    await ctx.journal.markUnknown(recordId);
    return { kind: "unknown", signature, reason: landing.reason };
  }
  return landing.kind === "landed" ? { kind: "landed", signature } : { kind: "landed-failed", signature, failure: landing.failure };
}
