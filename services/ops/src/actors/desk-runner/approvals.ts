/**
 * Carrying out a request the owner approved (Shijima `approved.ts`). The owner saw a price; by the time they answer
 * it has moved. So an approval is permission to do THAT action at about THAT price, never a standing order:
 * everything is read again with a fresh quote, every rule is checked again, and the desk acts only if the price is
 * still within half a percent of what the owner was shown. There is NO model call here. Requests nobody answered in
 * six hours lapse, and the owner is told.
 */
import { deskCopy, gate, nameOf, type ApprovalOf, type DeskNeed, type PlannedOutcome } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import { DESK_MINTS } from "@agari/markets/desk";
import type { ApprovalRow } from "@agari/db";
import { appendPlainRecord, commit } from "./commit";
import { blockersFor, DEADLINE_SEC, gateInputFor, SLIPPAGE_BPS, summaryOf, type Considered } from "./consider";
import { readMarket } from "./market";
import type { RunnerContext, WakeFrame, WakeRecord } from "./types";

/** How far the price may move against the owner between being shown it and the desk acting. */
export const APPROVAL_DRIFT_BPS = 50;

const iso = (sec: number) => new Date(sec * 1000).toISOString();

/** The need the request came from, rebuilt from the record that asked; undefined when the body no longer makes sense. */
async function needOf(ctx: RunnerContext, a: ApprovalRow): Promise<DeskNeed | undefined> {
  const stored = await ctx.q.getRecord({ deskId: a.deskId, seq: a.recordSeq });
  const body = stored?.record.body as { need?: { driftBps: number; thresholdBps: number; limitedByPerActionLimit: boolean } | null; candidate?: { id: string; why: string; protective: boolean } | null } | undefined;
  if (!body?.need || !body.candidate) return undefined;
  if (!/^\d+$/.test(a.amountIn) || !/^\d+$/.test(a.expectedOut)) return undefined;
  const symbol = a.symbol as PreIpoSymbol;
  if (!(symbol in DESK_MINTS)) return undefined;
  return {
    candidate: { id: body.candidate.id, side: a.side, symbol, mint: DESK_MINTS[symbol] as string, amountIn: BigInt(a.amountIn), why: body.candidate.why, protective: body.candidate.protective },
    driftBps: body.need.driftBps,
    thresholdBps: body.need.thresholdBps,
    limitedByPerAction: body.need.limitedByPerActionLimit,
  };
}

/** Reads everything again and decides whether the approved action still stands. */
export async function considerApproved(ctx: RunnerContext, frame: WakeFrame, a: ApprovalRow, need: DeskNeed): Promise<Considered & { approvalOf: ApprovalOf }> {
  const c = need.candidate;
  const read = await readMarket(ctx, frame.standing, c, c.amountIn, frame.nowSec);
  const freshGate = gate(gateInputFor(frame, need, c.amountIn, read));
  // The owner has just answered, so a recent identical trade is exactly what they asked for.
  const blockers = blockersFor(frame, need, read, freshGate, false);
  const shown = BigInt(a.expectedOut);
  const quoteOut = read.quote?.outAmount ?? 0n;
  // A move in the owner's favour is not a reason to refuse: only a worse price counts.
  const movedBps = shown === 0n ? 0 : Number(((shown - quoteOut) * 10_000n) / shown);
  const approvalOf: ApprovalOf = { decisionSeq: a.recordSeq, askedBecause: a.askedBecause, answeredAtIso: iso(a.answeredAtSec ?? frame.nowSec), movedBps };
  const base = { need, market: read.market, quote: read.quote, reference: read.reference, pack: null, gate: freshGate, blockers, answer: null, ask: null, override: null, deferral: null, newDeferralBaseline: null, approvalOf };
  const stop = (why: string): Considered & { approvalOf: ApprovalOf } => ({ ...base, outcome: "NOT_EXECUTED", willAct: false, summary: deskCopy.line.notExecuted(why), preview: null });
  if (a.expiresAtSec <= frame.nowSec) return stop("the request had already expired when I got to it.");
  const blocker = blockers[0];
  if (blocker) return stop(blocker.text);
  if (freshGate.result === "deny") return stop(deskCopy.blockedByLimit(freshGate.reasons));
  if (movedBps > APPROVAL_DRIFT_BPS) return stop(`the price moved ${(movedBps / 100).toFixed(2)}% against you since you were shown it; I only act within ${(APPROVAL_DRIFT_BPS / 100).toFixed(2)}%.`);
  const outcome: PlannedOutcome = need.limitedByPerAction ? "ACTED_IN_PART" : "ACTED";
  const preview = { amountIn: c.amountIn, expectedOut: quoteOut, slippageBps: SLIPPAGE_BPS, deadlineSec: frame.nowSec + DEADLINE_SEC };
  const considered: Considered = { ...base, outcome, willAct: true, summary: "", preview };
  return { ...considered, approvalOf, summary: summaryOf(considered, frame.nowSec) };
}

/** Every request the owner approved and the desk has not yet acted on, oldest first. True when money moved. */
export async function runApprovedRequests(ctx: RunnerContext, frame: WakeFrame, records: WakeRecord[]): Promise<boolean> {
  let moved = false;
  if (frame.dry || ctx.holding.has(frame.desk.id)) return false;
  for (const a of await ctx.q.approvedRequests(frame.desk.id)) {
    const need = await needOf(ctx, a);
    if (!need) {
      await ctx.q.markApprovalExecuted({ approvalId: a.id, executedSeq: 0 });
      frame.say(`approval ${a.id} for record ${a.recordSeq} no longer makes sense; left alone`);
      continue;
    }
    const checked = await considerApproved(ctx, frame, a, need);
    const done = await commit(ctx, frame, checked, { id: a.id, of: checked.approvalOf });
    records.push(done);
    frame.say(`approved request from record ${a.recordSeq}: ${checked.outcome}. ${checked.summary}${done.note ? ` ${done.note}` : ""}`);
    if (done.moved) {
      moved = true;
      frame.spentTodayE6 += checked.gate.countedE6;
    }
  }
  return moved;
}

/** Requests nobody answered have lapsed: nothing was done, and the owner is told through a record that rings. */
export async function expireOpenApprovals(ctx: RunnerContext, frame: WakeFrame, records: WakeRecord[]): Promise<void> {
  if (frame.dry) return;
  for (const lapsed of await ctx.q.expireApprovals({ deskId: frame.desk.id, nowSec: frame.nowSec })) {
    const done = await appendPlainRecord(ctx, frame, "NOT_EXECUTED", `${deskCopy.approvalExpired} (${nameOf(lapsed.symbol as PreIpoSymbol)}, asked with record ${lapsed.recordSeq}.)`);
    records.push(done);
    frame.say(`record ${done.seq}: approval from record ${lapsed.recordSeq} expired`);
  }
}
