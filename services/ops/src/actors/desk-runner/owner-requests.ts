/**
 * The owner's signed standing orders (C5's optional `requestOwnerAction`): sell everything, or close (sell
 * everything, then the desk is closed and the owner withdraws with the wallet). No model call: the owner decided.
 * Every sale is still sized inside the per-action cap, quoted for real and put through the limits check; a refusal
 * is recorded as a blocked action that rings, and the order stays open for the next wake. Recorded as
 * ACTED_BY_OVERRIDE with `override.by = "owner"`, so the desk's Timing sum leaves it out (core `grade.ts`).
 */
import { deskCopy, formatTokens, formatUsdc, gate, minBigint, nameOf, rawFor, type DeskNeed } from "@agari/core/desk";
import { DESK_MINTS } from "@agari/markets/desk";
import { appendPlainRecord, commit } from "./commit";
import { blockersFor, DEADLINE_SEC, gateInputFor, SLIPPAGE_BPS, type Considered } from "./consider";
import { readMarket } from "./market";
import { symbolsHeld } from "./reconcile";
import type { RunnerContext, WakeFrame, WakeRecord } from "./types";

const OWNER_REASON = "you asked me to sell everything";

/** Runs the pending order, if any. True when money moved (the caller re-reads the desk). */
export async function runOwnerRequest(ctx: RunnerContext, frame: WakeFrame, records: WakeRecord[]): Promise<boolean> {
  if (frame.dry || ctx.holding.has(frame.desk.id)) return false;
  const request = await ctx.q.pendingOwnerRequest(frame.desk.id);
  if (!request) return false;
  const held = symbolsHeld(frame.standing);
  // Nothing held any more: the order is done. `close` also closes the desk; the owner withdraws with the wallet.
  if (held.length === 0) {
    await ctx.q.finishOwnerRequest({ requestId: request.id, note: "every holding was sold", nowSec: frame.nowSec });
    if (request.kind === "close") {
      await ctx.q.setDeskState({ deskId: frame.desk.id, state: "closed", reason: "closed at your request", actor: "owner", nowSec: frame.nowSec });
      records.push(await appendPlainRecord(ctx, frame, "NOTHING_TO_DO", "I closed the desk at your request. What is left is yours to withdraw with your wallet."));
    }
    return false;
  }
  const priced = frame.valuation.holdings.filter((h) => held.includes(h.symbol) && h.priceE8 > 0n && !h.frozen && !h.paused);
  if (priced.length === 0) frame.say(`owner request ${request.kind}: nothing held can be priced or moved right now; the order stays open`);
  let moved = false;
  for (const h of priced) {
    const cap = minBigint(frame.mandate.perActionCapE6, frame.standing.kind === "live" ? frame.standing.chain.perActionCapE6 : frame.mandate.perActionCapE6);
    const highest = h.spotE8 && h.spotE8 > h.priceE8 ? h.spotE8 : h.priceE8;
    // Sized 2 % under the cap at the highest price the program might count, so the sale is never refused for its size.
    const amountIn = minBigint(h.raw, rawFor((cap * 9_800n) / 10_000n, h.multiplierE12, highest));
    if (amountIn <= 0n) continue;
    const need: DeskNeed = { candidate: { id: "c1", side: "sell", symbol: h.symbol, mint: DESK_MINTS[h.symbol] as string, amountIn, why: `You asked the desk to sell everything; it holds ${formatTokens(h.raw)} ${nameOf(h.symbol)} tokens.`, protective: true }, driftBps: h.driftBps, thresholdBps: 0, limitedByPerAction: amountIn < h.raw };
    const read = await readMarket(ctx, frame.standing, need.candidate, amountIn, frame.nowSec);
    const g = gate(gateInputFor(frame, need, amountIn, read));
    const blockers = blockersFor(frame, need, read, g, false).filter((b) => b.rule !== "DID_THIS_MINUTES_AGO");
    const base = { need, market: read.market, quote: read.quote, reference: read.reference, pack: null, gate: g, blockers, answer: null, ask: null, deferral: null, newDeferralBaseline: null, override: { by: "owner", reason: OWNER_REASON } };
    let considered: Considered;
    if (blockers[0] || g.result === "deny") {
      const why = blockers[0]?.text ?? deskCopy.blockedByLimit(g.reasons);
      considered = { ...base, outcome: "BLOCKED_BY_LIMIT", willAct: false, summary: deskCopy.line.blocked([why]), preview: null };
    } else {
      const expectedOut = read.quote?.outAmount ?? 0n;
      const live = frame.standing.kind === "live";
      const summary = live ? deskCopy.line.sold(formatTokens(amountIn), nameOf(h.symbol), `$${formatUsdc(expectedOut)}`, "You asked me to sell everything.") : deskCopy.line.wouldHaveSold(formatTokens(amountIn), nameOf(h.symbol), "You asked me to sell everything.");
      considered = { ...base, outcome: live ? "ACTED_BY_OVERRIDE" : "WOULD_HAVE_ACTED", willAct: live, summary, preview: { amountIn, expectedOut, slippageBps: SLIPPAGE_BPS, deadlineSec: live ? frame.nowSec + DEADLINE_SEC : null } };
    }
    const done = await commit(ctx, frame, considered);
    records.push(done);
    frame.say(`owner request ${request.kind}: ${considered.outcome}. ${considered.summary}${done.note ? ` ${done.note}` : ""}`);
    if (done.moved) {
      moved = true;
      frame.spentTodayE6 += considered.gate.countedE6;
    }
    // One sale per wake per name; a refusal stops the order until the next wake, when the picture may differ.
    if (!done.moved) break;
  }
  return moved;
}
