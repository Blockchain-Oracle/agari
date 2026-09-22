/**
 * The daily seal (desk.md §0.3, plan §8 C4): at 00:05 UTC every live desk writes a record with no trade and sends
 * `operator_checkpoint` with its hash, so the quiet hours join the on-chain chain too (each record's `prevHash`
 * links the ones before it). Allowed while paused and in mode 0: "paused, did nothing" is a record as well. The
 * second consecutive check below the loss limit also pauses the desk ON THE CHAIN, so even a stolen operator key
 * could not trade it; only the owner's wallet lifts that.
 */
import { chainHead, deskCopy } from "@agari/core/desk";
import { checkpoint, DeskSendError, DeskSendUnknownError, pauseIx } from "@agari/markets/desk";
import { errorText } from "../../runtime/env";
import { appendPlainRecord } from "./commit";
import { DEADLINE_SEC } from "./consider";
import type { RunnerContext, WakeFrame, WakeRecord } from "./types";

/** The checkpoint window: from five past midnight UTC until the hour is out. */
export const CHECKPOINT_AFTER_SEC = 5 * 60;
export const daySlotSec = (nowSec: number): number => Math.floor(nowSec / 86_400) * 86_400;
export const inCheckpointWindow = (nowSec: number): boolean => nowSec - daySlotSec(nowSec) >= CHECKPOINT_AFTER_SEC && nowSec - daySlotSec(nowSec) < 3600;

/** Writes the checkpoint record and seals it on chain; the record stays unsealed (and says so) if the send fails. */
export async function sealCheckpoint(ctx: RunnerContext, frame: WakeFrame): Promise<WakeRecord> {
  const { desk } = frame;
  const chain = frame.standing.kind === "live" ? frame.standing.chain : null;
  const record = await appendPlainRecord(ctx, frame, "NOTHING_TO_DO", deskCopy.line.checkpoint, "checkpoint");
  if (!chain || !ctx.operator || frame.dry) return record;
  const deadlineSec = frame.nowSec + DEADLINE_SEC;
  const actionId = await ctx.q.insertAction({ deskId: desk.id, recordSeq: record.seq, kind: "checkpoint", state: "attempting", signature: null, symbol: null, amountIn: null, expectedOut: null, minOut: null, countedE6: null, deadlineSec, sentAtSec: frame.nowSec });
  try {
    const sent = await checkpoint(ctx.operator, { owner: desk.owner as never, deadlineSec, decisionHash: record.hash });
    const expectedHead = chainHead(chain.head, sent.sealed.seq, record.hash);
    await ctx.q.resolveAction({ id: actionId, state: "confirmed", signature: sent.signature, chainSeq: Number(sent.sealed.seq), nowSec: frame.nowSec });
    await ctx.q.markSealed({ deskId: desk.id, seq: record.seq, signature: sent.signature, chainSeq: Number(sent.sealed.seq) });
    await ctx.q.setChainPosition({ deskId: desk.id, chainSeq: Number(sent.sealed.seq), chainHead: sent.sealed.head, nowSec: frame.nowSec });
    if (sent.sealed.head.toLowerCase() !== expectedHead.toLowerCase()) {
      await ctx.q.setDeskState({ deskId: desk.id, state: "needs_attention", reason: `the chain sealed checkpoint record ${record.seq} with a head this desk cannot reproduce`, actor: "desk", nowSec: frame.nowSec });
    }
    frame.say(`checkpoint sealed in ${sent.signature}`);
  } catch (error) {
    if (error instanceof DeskSendUnknownError) {
      await ctx.q.resolveAction({ id: actionId, state: "unknown", signature: error.signature, error: error.message, nowSec: frame.nowSec });
      ctx.holding.add(desk.id);
    } else {
      await ctx.q.resolveAction({ id: actionId, state: error instanceof DeskSendError && error.stage === "landed" ? "reverted" : "refused", error: errorText(error), nowSec: frame.nowSec });
    }
    frame.say(`checkpoint not sealed: ${errorText(error)}`);
  }
  return record;
}

/** `pause` from the operator key: the loss limit's second breach in a row. */
export async function pauseOnChain(ctx: RunnerContext, frame: WakeFrame): Promise<string | null> {
  const chain = frame.standing.kind === "live" ? frame.standing.chain : null;
  if (!chain || !ctx.operator || chain.paused || frame.dry) return null;
  try {
    const sent = await ctx.operator.send("pause", [await pauseIx(ctx.operator.signer, frame.desk.owner as never)]);
    await ctx.q.addEvent({ deskId: frame.desk.id, kind: "paused_on_chain", actor: "desk", detail: { signature: sent.signature, why: "loss limit, second breach" }, atSec: frame.nowSec });
    return sent.signature;
  } catch (error) {
    frame.say(`could not pause on chain: ${errorText(error)}`);
    return null;
  }
}
