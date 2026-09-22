/**
 * One check of one desk (Shijima `wake.ts:160–521`, minus the savings vault):
 *
 *   reconcile -> valuation (and the loss limit) -> approved requests -> needs -> for each candidate: consider,
 *   record, act -> practice checks counted -> the wake finished
 *
 * With `dry` set it reads, values and asks the model exactly as a real check would, then commits NOTHING and sends
 * NOTHING. Every wake is a decision, even "nothing to do": a record is written either way.
 */
import { deskCopy, drawdownBps, findNeeds, formatUsdc, MAX_CANDIDATES, mandateFromWire, nameOf, type DeskMandateWire, type DeskNeed } from "@agari/core/desk";
import { errorText } from "../../runtime/env";
import { expireOpenApprovals, runApprovedRequests } from "./approvals";
import { pauseOnChain, sealCheckpoint } from "./checkpoint";
import { appendPlainRecord, commit } from "./commit";
import { considerCandidate, mandateLineOf, REPEAT_WINDOW_SEC } from "./consider";
import { runOwnerRequest } from "./owner-requests";
import { allPriced, netFlowE6, reconcile, scaledBaseline } from "./reconcile";
import type { RunnerContext, WakeFrame, WakeInput, WakeRecord, WakeReport } from "./types";
import { priceView, refreshMints, valueNow } from "./value";

/** On this many consecutive checks below the loss limit, a live desk pauses itself on the chain. */
const ON_CHAIN_PAUSE_AT_BREACH = 2;

const stateText = (state: WakeFrame["desk"]["state"], mode: WakeFrame["desk"]["mode"]): string =>
  state === "active" ? (mode === "practice" ? deskCopy.deskState.practice : deskCopy.deskState.active) : state === "paused" ? deskCopy.deskState.paused_by_owner : state === "stopped_by_loss" ? deskCopy.deskState.stopped_by_loss_limit : deskCopy.deskState.needs_attention;

const usd = (e6: bigint) => `$${formatUsdc(e6)}`;
const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`;

export async function wakeDesk(ctx: RunnerContext, input: WakeInput): Promise<WakeReport> {
  const { desk } = input;
  const dry = input.dry === true;
  const short = desk.id.slice(0, 8);
  const say = (line: string) => ctx.log(`desk ${short} ${input.trigger}: ${line}`);
  const records: WakeRecord[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  const finish = async (status: WakeReport["status"], note?: string): Promise<WakeReport> => {
    if (input.wakeId && !dry) await ctx.q.finishWake({ wakeId: input.wakeId, status: status === "completed" ? "completed" : status === "skipped" ? "skipped" : "failed", error: status === "failed" ? (note ?? null) : null, nowSec: Math.floor(Date.now() / 1000) });
    const paper = desk.mode === "practice" ? await ctx.q.getPaper(desk.id) : null;
    return { status, ...(note ? { note } : {}), records, ...(paper ? { paper: { cashE6: paper.cashE6, positions: paper.positions } } : {}) };
  };

  const mandateRow = await ctx.q.currentMandate(desk.id);
  if (!mandateRow) return finish("skipped", "no mandate has been applied yet");
  if (desk.state === "closed") return finish("skipped", "the desk is closed");
  const mandate = mandateFromWire(mandateRow.body as unknown as DeskMandateWire);

  try {
    // The mints' multipliers and pause flags, fresh within ten minutes: every valuation converts raw units through them.
    await refreshMints(ctx, nowSec);
    // 1. reconcile: is this still our desk, and does the chain agree with the database?
    const reconciled = await reconcile(ctx, desk, nowSec, say);
    if (reconciled.trouble) {
      if (!dry) await ctx.q.setDeskState({ deskId: desk.id, state: "needs_attention", reason: reconciled.trouble, actor: "desk", nowSec });
      return finish("failed", reconciled.trouble);
    }
    let standing = reconciled.standing;

    // 2. valuation on the half-hour mean; outside money moves the baseline, never the loss.
    let valuation = valueNow(ctx, standing, mandate, nowSec);
    say(`worth ${usd(valuation.totalE6)}: cash ${usd(valuation.cashE6)} (${pct(valuation.cashWeightBps)})${valuation.holdings.map((h) => `, ${h.symbol} ${usd(h.valueE6)} (${pct(h.weightBps)} of target ${pct(h.targetBps)})`).join("")}`);
    for (const u of valuation.unpriced) say(`NOT VALUED: ${u.why}`);
    const unpricedFlow = reconciled.changes.length > 0 && !allPriced(reconciled.changes);
    if (reconciled.changes.length > 0) say(`balances changed outside the desk: ${reconciled.changes.map((c) => `${c.asset} ${c.delta > 0n ? "+" : ""}${c.delta}`).join(", ")}`);
    let baselineE6 = desk.drawdownBaselineE6 ? BigInt(desk.drawdownBaselineE6) : null;
    if (!dry) {
      if (reconciled.changes.length > 0) {
        baselineE6 = unpricedFlow ? null : scaledBaseline(baselineE6 ?? valuation.totalE6, valuation.totalE6, netFlowE6(reconciled.changes));
        await ctx.q.setDrawdownBaseline({ deskId: desk.id, baselineE6: baselineE6?.toString() ?? null, nowSec });
        await ctx.q.addEvent({ deskId: desk.id, kind: "outside_change", actor: "owner", detail: { changes: reconciled.changes.map((c) => ({ asset: c.asset, delta: c.delta.toString(), valueE6: c.priced ? c.valueE6.toString() : null })) }, atSec: nowSec });
      }
      await ctx.q.saveSnapshot({
        deskId: desk.id,
        takenAtSec: nowSec,
        totalE6: valuation.totalE6.toString(),
        usdcE6: valuation.cashE6.toString(),
        holdings: valuation.holdings.map((h) => {
          const view = priceView(ctx.feed, h.symbol, nowSec);
          return { symbol: h.symbol, mint: h.mint, raw: h.raw.toString(), priceE8: h.priceE8.toString(), valueE6: h.valueE6.toString(), weightBps: h.weightBps, targetBps: h.targetBps, driftBps: h.driftBps, premiumBps: h.premiumBps, priceAgeSec: view ? nowSec - view.fetchedAtSec : null, paused: h.paused, frozen: h.frozen };
        }),
        unpriced: valuation.unpriced.map((u) => ({ symbol: u.symbol, mint: u.mint, raw: u.raw.toString(), why: u.why })),
      });
      // A baseline made unknown by an unpriced change is set again only once every holding has a price.
      if (baselineE6 === null && valuation.unpriced.length === 0 && !unpricedFlow && valuation.totalE6 > 0n) {
        baselineE6 = valuation.totalE6;
        await ctx.q.setDrawdownBaseline({ deskId: desk.id, baselineE6: baselineE6.toString(), nowSec });
      }
    }

    // 3. the loss limit, judged only on a fully priced valuation: an RPC failure is not a loss.
    let deskState = desk.state;
    const canJudge = baselineE6 !== null && valuation.unpriced.length === 0 && !unpricedFlow && !dry;
    const lossBps = canJudge ? drawdownBps(valuation.totalE6, baselineE6 as bigint) : 0;
    const breached = canJudge && lossBps >= mandate.lossStopBps;
    const breaches = dry ? 0 : await ctx.q.recordLossBreach({ deskId: desk.id, breached, nowSec });
    const frame: WakeFrame = {
      desk, mandate, mandateRow, mandateLine: mandateLineOf({ mandate, mandateRow }), standing, valuation,
      deskActive: deskState === "active", deskStateText: stateText(deskState, desk.mode),
      spentTodayE6: BigInt(await ctx.q.spentSince({ deskId: desk.id, sinceSec: nowSec - 86_400 })),
      nowSec, trigger: input.trigger, scheduledForSec: input.scheduledForSec, wakeId: input.wakeId, dry, say,
    };
    if (breached && deskState === "active") {
      const why = deskCopy.lossLimitReached(usd(valuation.totalE6), lossBps, usd(baselineE6 as bigint), mandate.lossStopBps);
      deskState = "stopped_by_loss";
      frame.deskActive = false;
      frame.deskStateText = stateText(deskState, desk.mode);
      await ctx.q.setDeskState({ deskId: desk.id, state: deskState, reason: why, actor: "desk", nowSec });
      records.push(await appendPlainRecord(ctx, frame, "BLOCKED_BY_LIMIT", deskCopy.line.stoppedByLoss(why)));
      say(`STOPPED BY THE LOSS LIMIT. ${why}`);
    }
    if (breached && breaches >= ON_CHAIN_PAUSE_AT_BREACH) {
      const paused = await pauseOnChain(ctx, frame);
      if (paused) say(`paused on chain: ${paused}`);
    }

    // The daily seal is its own wake: one record, one checkpoint instruction.
    if (input.trigger === "checkpoint") {
      records.push(await sealCheckpoint(ctx, frame));
      return finish("completed");
    }

    /** Reads the desk and values it again after money moved, so nothing later works on a stale picture. */
    const refresh = async () => {
      const again = await reconcile(ctx, desk, nowSec, () => undefined);
      standing = again.standing;
      valuation = valueNow(ctx, standing, mandate, nowSec);
      frame.standing = standing;
      frame.valuation = valuation;
    };

    // 4. what the owner ordered or approved comes first; what nobody answered has lapsed.
    if (await runOwnerRequest(ctx, frame, records)) await refresh();
    if (await runApprovedRequests(ctx, frame, records)) await refresh();
    await expireOpenApprovals(ctx, frame, records);

    // 5. needs: arithmetic only. A desk that is not active looks, values and proposes nothing.
    const chainCap = standing.kind === "live" ? standing.chain.perActionCapE6 : mandate.perActionCapE6;
    const currentNeeds = (): DeskNeed[] => {
      if (!frame.deskActive) return [];
      const priceless = new Set(valuation.unpriced.map((u) => u.symbol));
      return findNeeds(valuation, mandate, chainCap).filter((n) => !priceless.has(n.candidate.symbol));
    };
    let needs = currentNeeds();
    if (needs.length === 0) {
      const funded = valuation.totalE6 > 0n;
      const unpriced = valuation.unpriced.filter((u) => mandate.targets.tokens.some((t) => t.symbol === u.symbol));
      const summary = !frame.deskActive ? deskCopy.notLooking(frame.deskStateText) : !funded ? deskCopy.notFunded : unpriced.length > 0 ? deskCopy.line.checkedUnpriced(unpriced.map((u) => nameOf(u.symbol)).join(" and ")) : deskCopy.line.checkedNothing;
      if (dry) records.push({ seq: null, hash: null, outcome: "NOTHING_TO_DO", summary });
      else records.push(await appendPlainRecord(ctx, frame, "NOTHING_TO_DO", summary));
      say(`record ${records.at(-1)?.seq ?? "(dry)"}: NOTHING_TO_DO. ${summary}`);
    }

    // 6. each candidate: consider, record, act. After money moves the rest are sized on the fresh picture.
    const done = new Set<string>();
    let considered = 0;
    while (needs.length > 0 && considered < MAX_CANDIDATES) {
      const need = needs[0] as DeskNeed;
      needs = needs.slice(1);
      const key = `${need.candidate.side}:${need.candidate.symbol}`;
      if (done.has(key)) continue;
      done.add(key);
      considered += 1;
      say(`${need.candidate.id} ${need.candidate.side.toUpperCase()} ${need.candidate.symbol}: ${need.candidate.why}`);
      let moved = false;
      try {
        moved = await runCandidate(ctx, frame, need, records);
      } catch (error) {
        const message = errorText(error);
        say(`  ${need.candidate.id} failed: ${message}`);
        const summary = deskCopy.noUsableDecision(message);
        if (dry) records.push({ seq: null, hash: null, outcome: "FAILED_NO_DECISION", summary });
        else records.push(await appendPlainRecord(ctx, frame, "FAILED_NO_DECISION", summary));
      }
      if (moved) {
        await refresh();
        needs = currentNeeds().filter((n) => !done.has(`${n.candidate.side}:${n.candidate.symbol}`));
      }
    }

    // Going live is earned: six hourly practice checks. A check the owner asked for by hand never counts.
    if (!dry && desk.mode === "practice" && input.trigger === "hour") await ctx.q.bumpPracticeChecks({ deskId: desk.id, nowSec });
    return finish("completed");
  } catch (error) {
    const message = errorText(error);
    say(`failed: ${message}`);
    return finish("failed", message);
  }
}

/** One candidate through consider, record and act. True when money moved. Throws on a read the check could not make. */
async function runCandidate(ctx: RunnerContext, frame: WakeFrame, need: DeskNeed, records: WakeRecord[]): Promise<boolean> {
  const { desk } = frame;
  const symbol = need.candidate.symbol;
  const [standing, askedAtSec, repeated, last] = await Promise.all([
    ctx.q.standingDeferral({ deskId: desk.id, symbol }),
    ctx.q.pendingApprovalSince({ deskId: desk.id, symbol, nowSec: frame.nowSec }),
    ctx.q.didSameTradeSince({ deskId: desk.id, symbol, side: need.candidate.side, sinceSec: frame.nowSec - REPEAT_WINDOW_SEC }),
    ctx.q.lastRecordOnSymbol({ deskId: desk.id, symbol }),
  ]);
  const recent = last
    ? { lastOnThisNameIso: new Date(last.decidedAtSec * 1000).toISOString(), lastOutcome: last.outcome, minutesSince: Math.floor((frame.nowSec - last.decidedAtSec) / 60) }
    : { lastOnThisNameIso: null, lastOutcome: null, minutesSince: null };
  let considered = await considerCandidate(ctx, frame, { need, standing, askedAtSec, repeatedWithinMinutes: repeated, recent });
  // The model takes many seconds. The owner may have paused in that time, so the state is read again NOW.
  if (considered.willAct || considered.ask) {
    const fresh = await ctx.q.getDeskById(desk.id);
    if (fresh && fresh.state !== "active") {
      const text = deskCopy.pausedMeanwhile(stateText(fresh.state, fresh.mode));
      considered = { ...considered, willAct: false, ask: null, outcome: "DECLINED", summary: text, blockers: [{ rule: "DESK_NOT_ACTIVE", text }], preview: null, newDeferralBaseline: null };
    }
  }
  if (frame.dry) {
    records.push({ seq: null, hash: null, outcome: considered.outcome, summary: considered.summary });
    frame.say(`  record (dry): ${considered.outcome}. ${considered.summary}`);
    return false;
  }
  if (ctx.holding.has(desk.id) && considered.willAct) {
    const text = "an earlier send is still unconfirmed, so nothing new is sent until it is settled";
    considered = { ...considered, willAct: false, outcome: "NOT_EXECUTED", summary: deskCopy.line.failed(text), preview: null };
  }
  const acted = await commit(ctx, frame, considered);
  records.push(acted);
  frame.say(`  record ${acted.seq}: ${considered.outcome}. ${considered.summary}${acted.note ? ` ${acted.note}` : ""}`);
  if (acted.moved) frame.spentTodayE6 += considered.gate.countedE6;
  return acted.moved;
}
