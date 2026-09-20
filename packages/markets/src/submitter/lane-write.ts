import type { PhaseListener, TxIntent, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Signature } from "@agari/core/types";
import type { Instruction } from "@solana/kit";
import { diagnose } from "../errors/error-map";
import { failureDiagnosis } from "./chain-failure";
import { OrderRefusedError, SimulationFailedError } from "./errors";
import { signSendConfirm, type WriteContext } from "./settle-write";
import { buildWrite } from "./steps/message";

/**
 * One product instruction through the session's queued lane: build it, simulate, journal, sign, send, confirm.
 *
 * The maker's, the parlay's and the range's plain writes were three copies of this body. A refusal while building
 * the instruction (`OrderRefusedError`) and a failed simulation both come back as `refused`, with nothing sent.
 */
export async function submitLaneWrite(ctx: WriteContext, kind: TxIntent["kind"], build: () => Promise<Instruction>, onPhase?: PhaseListener): Promise<TxOutcome> {
  try {
    const built = await buildWrite(ctx.rpc, ctx.signer, [await build()]);
    const record = await ctx.journal.record({ kind, wallet: ctx.wallet, summary: kind });
    onPhase?.("submitted");
    const settled = await signSendConfirm(ctx, record.id, built, onPhase);
    if (settled.kind === "not-sent") return laneRefusal(settled.error);
    const txHash = settled.signature as Signature;
    if (settled.kind === "unknown") {
      return { status: "unknown", diagnosis: diagnosis("send-unknown", `no confirmation (${settled.reason})`, { txHash }), txHash };
    }
    if (settled.kind === "landed-failed") {
      const diag = failureDiagnosis(settled.failure);
      await ctx.journal.markFailed(record.id, `landed: ${diag.technical}`);
      return { status: "reverted", diagnosis: diagnosis(diag.kind, diag.technical, { txHash }), txHash };
    }
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash });
    return { status: "confirmed", txHash };
  } catch (error) {
    return laneRefusal(error);
  }
}

export function laneRefusal(error: unknown): TxOutcome {
  if (error instanceof OrderRefusedError) return { status: "refused", diagnosis: error.diagnosis };
  if (error instanceof SimulationFailedError) return { status: "refused", diagnosis: failureDiagnosis(error.failure) };
  return { status: "refused", diagnosis: diagnose(error) };
}
