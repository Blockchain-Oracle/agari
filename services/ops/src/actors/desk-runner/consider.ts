/**
 * One candidate, from "arithmetic says this would help" to "this is what the desk decided and why" (Shijima
 * `consider.ts`, on core's pure pieces). It reads and thinks; it writes nothing, so the drive's dry wake runs the very
 * same code and commits nothing.
 *
 *   market -> gate -> pre-gate (code says no) -> already asked the owner -> a remembered decision still stands
 *   -> the model decides when -> size and gate again -> the mode turns "wants to act" into act, ask, or would have
 *
 * The first four can each end it with NO model call.
 */
import {
  buildEvidence, deskCopy, describeCandidate, formatTokens, formatUsdc, gate, nameOf, ownerRules, planOutcome, plainHeadline, pregate, sizedAmount, whyDeferralEnds,
  type AskReason, type Blocker, type DeferralBaseline, type DeskEvidencePack, type DeskGateInput, type DeskGateResult, type DeskMarketRead, type DeskNeed, type DeskTimingAnswer, type Override, type PlannedOutcome,
} from "@agari/core/desk";
import type { DeferralRow } from "@agari/db";
import { DESK_MODE_CODE } from "@agari/core/desk";
import type { JupiterQuote } from "@agari/markets/desk";
import { askTiming } from "./decide";
import { readMarket, type MarketRead } from "./market";
import type { RunnerContext, WakeFrame } from "./types";

export const SLIPPAGE_BPS = 50;
/** The program's deadline on a send: the operator's clock plus this. */
export const DEADLINE_SEC = 120;
/** The desk will not repeat the same trade on the same name inside this window. */
export const REPEAT_WINDOW_SEC = 10 * 60;
/** An approval request lapses after this (plan §5.8). */
export const APPROVAL_TTL_SEC = 6 * 3600;
const REFERENCE_MAX_AGE_SEC = 900;

export interface Considered {
  need: DeskNeed;
  market: DeskMarketRead;
  quote: JupiterQuote | null;
  reference: MarketRead["reference"];
  pack: DeskEvidencePack | null;
  gate: DeskGateResult;
  blockers: Blocker[];
  answer: DeskTimingAnswer | null;
  outcome: PlannedOutcome;
  ask: AskReason | null;
  willAct: boolean;
  override: Override | null;
  summary: string;
  /** What would be sent, asked about, or "would have" been sent; null when the desk does not want to act. */
  preview: { amountIn: bigint; expectedOut: bigint; slippageBps: number; deadlineSec: number | null } | null;
  deferral: { row: DeferralRow; baseline: DeferralBaseline; endedBecause: string | null; status: "standing" | "broken" | "revisited" } | null;
  newDeferralBaseline: Omit<DeferralBaseline, "decisionSeq"> | null;
}

const clock = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 16);
const iso = (sec: number) => new Date(sec * 1000).toISOString();
export const nextTopOfHourSec = (nowSec: number) => (Math.floor(nowSec / 3600) + 1) * 3600;

/** The mandate in one sentence for the model and the record. */
export function mandateLineOf(frame: Pick<WakeFrame, "mandate" | "mandateRow">): string {
  const m = frame.mandate;
  const targets = m.targets.tokens.map((t) => `${nameOf(t.symbol)} ${(t.weightBps / 100).toFixed(1)}%`).join(", ");
  return `MANDATE v${frame.mandateRow.version}: hold ${targets}, and ${(m.targets.cashBps / 100).toFixed(1)}% cash. A holding may wander ${(m.driftToleranceBps / 100).toFixed(1)}% from its target. No holding above ${(m.maxPositionBps / 100).toFixed(1)}%.`;
}

/** The gate's input for this desk at this size: the chain's own numbers for a live desk, the mandate's for practice. */
export function gateInputFor(frame: WakeFrame, need: DeskNeed, amountIn: bigint, read: MarketRead): DeskGateInput {
  const c = need.candidate;
  const { standing, mandate, valuation } = frame;
  const held = standing.positions[c.symbol] ?? 0n;
  const holding = valuation.holdings.find((h) => h.symbol === c.symbol);
  const live = standing.kind === "live" ? standing.chain : null;
  const token = live?.tokens.find((t) => t.symbol === c.symbol);
  const referenceAge = read.reference ? frame.nowSec - read.reference.fetchedAtSec : null;
  return {
    side: c.side,
    amountIn,
    quoteOut: read.quote?.outAmount ?? 0n,
    tokenPriceE8: read.reference?.tokenPriceE8 ?? 0n,
    multiplierE12: read.reference?.multiplierE12 ?? 0n,
    referenceE8: live?.requirePythIndex ? read.market.indexE8 : (read.reference?.markPriceE8 ?? null),
    maxPremiumBps: live ? Math.min(live.maxPremiumBps, mandate.maxPremiumBps) : mandate.maxPremiumBps,
    slippageBps: BigInt(SLIPPAGE_BPS),
    mandate: { perActionCapE6: mandate.perActionCapE6, dailyCapE6: mandate.dailyCapE6, spentTodayE6: frame.spentTodayE6 },
    desk: {
      paused: live?.paused ?? false,
      // A practice desk is gated as the live desk it rehearses (mode 1): the chain's own "practice refuses everything" is not the point of a rehearsal.
      mode: live ? DESK_MODE_CODE[live.mode] : 1,
      perActionCapE6: live?.perActionCapE6 ?? mandate.perActionCapE6,
      remainingDailyCapE6: live ? live.remainingDailyCapE6 : mandate.dailyCapE6 > frame.spentTodayE6 ? mandate.dailyCapE6 - frame.spentTodayE6 : 0n,
      cashE6: standing.cashE6,
      tokenBalanceRaw: held,
      configured: live ? Boolean(token) : true,
      enabled: live ? Boolean(token?.enabled) : true,
      referenceFresh: referenceAge !== null && referenceAge <= REFERENCE_MAX_AGE_SEC,
    },
    gapBps: read.market.gapBps,
    costBps: read.market.costBps ?? 0,
    protective: c.protective,
    position: { holdingE6: holding?.valueE6 ?? 0n, totalE6: valuation.totalE6, maxPositionBps: mandate.maxPositionBps },
  };
}

export function blockersFor(frame: WakeFrame, need: DeskNeed, read: MarketRead, g: DeskGateResult, repeatedWithinMinutes: boolean): Blocker[] {
  const live = frame.standing.kind === "live" ? frame.standing.chain : null;
  const token = live?.tokens.find((t) => t.symbol === need.candidate.symbol);
  const requireIndex = live?.requirePythIndex ?? false;
  return pregate({
    candidate: need.candidate,
    market: read.market,
    deskActive: frame.deskActive,
    deskStateText: frame.deskStateText,
    onChain: live ? { configured: Boolean(token), enabled: Boolean(token?.enabled) } : { configured: true, enabled: true },
    premiumBps: requireIndex ? read.market.indexPremiumBps : read.market.premiumBps,
    maxPremiumBps: live ? Math.min(live.maxPremiumBps, frame.mandate.maxPremiumBps) : frame.mandate.maxPremiumBps,
    beyondBand: g.reasons.includes(deskCopy.gate.beyondBand),
    repeatedWithinMinutes,
  });
}

/** The first-person line for what was decided (plan §5.8); the acting lines are written from the preview. */
export function summaryOf(k: Pick<Considered, "outcome" | "gate" | "answer" | "preview" | "market" | "need">, nowSec: number): string {
  const c = k.need.candidate;
  const name = nameOf(c.symbol);
  const headline = plainHeadline(k.answer?.decision) ?? "";
  const why = headline.endsWith(".") ? headline : `${headline}.`;
  const usdc = (e6: bigint) => `$${formatUsdc(e6)}`;
  const amountIn = k.preview?.amountIn ?? c.amountIn;
  const expectedOut = k.preview?.expectedOut ?? k.market.quoteOut ?? 0n;
  switch (k.outcome) {
    case "BLOCKED_BY_LIMIT":
      return deskCopy.line.blocked(k.gate.reasons);
    case "WAITED":
      return deskCopy.line.waited(name, why);
    case "DECLINED":
      return deskCopy.line.declined(name, why);
    case "FAILED_NO_DECISION":
      return deskCopy.line.noDecision(k.answer?.error ?? k.answer?.problems.join("; ") ?? "no answer");
    case "WOULD_HAVE_ACTED":
      return c.side === "buy" ? deskCopy.line.wouldHaveBought(usdc(amountIn), name, why) : deskCopy.line.wouldHaveSold(formatTokens(amountIn), name, why);
    case "ASKED":
      return deskCopy.line.asked(c.side === "buy" ? `buy ${usdc(amountIn)} of ${name}` : `sell ${formatTokens(amountIn)} ${name}`, `${clock(nowSec + APPROVAL_TTL_SEC)} UTC`);
    default: {
      // Acting: the fee line names what this exact trade costs against the price, PreStocks' 1% included.
      const feesE6 = c.side === "buy" ? (amountIn * BigInt(k.market.costBps ?? 0)) / 10_000n : (expectedOut * BigInt(k.market.costBps ?? 0)) / 10_000n;
      return c.side === "buy" ? deskCopy.line.bought(usdc(amountIn), name, why, usdc(feesE6)) : deskCopy.line.sold(formatTokens(amountIn), name, usdc(expectedOut), why);
    }
  }
}

export interface ConsiderInput {
  need: DeskNeed;
  standing: DeferralRow | null;
  /** When the owner was last asked about this name and has not answered. */
  askedAtSec: number | null;
  repeatedWithinMinutes: boolean;
  recent: { lastOnThisNameIso: string | null; lastOutcome: string | null; minutesSince: number | null };
}

export async function considerCandidate(ctx: RunnerContext, frame: WakeFrame, i: ConsiderInput): Promise<Considered> {
  const { need } = i;
  const c = need.candidate;
  const read = await readMarket(ctx, frame.standing, c, c.amountIn, frame.nowSec);
  const fullGate = gate(gateInputFor(frame, need, c.amountIn, read));
  const settle = (outcome: PlannedOutcome, summary: string, blockers: Blocker[], deferral: Considered["deferral"]): Considered => ({
    need, market: read.market, quote: read.quote, reference: read.reference, pack: null, gate: fullGate, blockers, answer: null, outcome, ask: null, willAct: false, override: null, summary, preview: null, deferral, newDeferralBaseline: null,
  });

  const blockers = blockersFor(frame, need, read, fullGate, i.repeatedWithinMinutes);
  const first = blockers[0];
  if (first) return settle("DECLINED", first.text, blockers, null);
  if (i.askedAtSec !== null) return settle("WAITED", deskCopy.remembered.stillWaitingForAnswer(clock(i.askedAtSec)), [], null);

  let deferral: Considered["deferral"] = null;
  let standingWait: { seq: number; decidedAtIso: string } | null = null;
  if (i.standing) {
    const baseline = i.standing.baseline as unknown as DeferralBaseline;
    const ended = whyDeferralEnds(baseline, { atSec: frame.nowSec, premiumBps: read.market.premiumBps, spotE8: read.market.spotE8, driftBps: need.driftBps, cashE6: frame.standing.cashE6 }, frame.mandate.driftToleranceBps);
    deferral = { row: i.standing, baseline, endedBecause: ended?.reason ?? null, status: ended?.status ?? "standing" };
    if (!ended) {
      const at = clock(baseline.decidedAtSec);
      return baseline.kind === "would_have"
        ? settle("NOTHING_TO_DO", deskCopy.remembered.wouldAlreadyHave(c.side === "buy" ? "bought" : "sold", nameOf(c.symbol), at), [], deferral)
        : settle("WAITED", deskCopy.remembered.stillWaiting(at), [], deferral);
    }
    standingWait = { seq: baseline.decisionSeq, decidedAtIso: iso(baseline.decidedAtSec) };
  }

  const holding = frame.valuation.holdings.find((h) => h.symbol === c.symbol);
  const live = frame.standing.kind === "live" ? frame.standing.chain : null;
  const rules = ownerRules(frame.mandate.notes);
  const pack = buildEvidence(
    c,
    read.market,
    { perActionCapE6: live?.perActionCapE6 ?? frame.mandate.perActionCapE6, remainingTodayE6: gateInputFor(frame, need, c.amountIn, read).desk.remainingDailyCapE6, cashE6: frame.standing.cashE6, tokenBalanceRaw: frame.standing.positions[c.symbol] ?? 0n, paused: live?.paused ?? false, referenceFresh: fullGate.reasons.includes(deskCopy.gate.referenceStale) === false },
    fullGate,
    {
      mandateLine: frame.mandateLine,
      rules,
      trigger: frame.trigger,
      nextCheckIso: iso(nextTopOfHourSec(frame.nowSec)),
      position: { weightBps: holding?.weightBps ?? 0, targetBps: holding?.targetBps ?? 0, driftBps: need.driftBps, thresholdBps: need.thresholdBps },
      recent: { ...i.recent, standingWait },
    },
  );
  frame.say(`  ${c.id} ${describeCandidate(c, read.market.quoteOut)}`);

  const answer = await askTiming(ctx, pack, rules.map((r) => r.text), frame.nowSec * 1000);
  frame.say(`  model: ${answer.decision ? `${answer.decision.option} (${answer.decision.confidencePercent}%)` : answer.error ? `no decision, ${answer.error}` : `rejected: ${answer.problems.join("; ")}`}`);
  const amountIn = sizedAmount(c.amountIn, answer.decision, null);
  const isPart = amountIn < c.amountIn;
  const partRead = isPart ? await readMarket(ctx, frame.standing, c, amountIn, frame.nowSec) : read;
  const finalGate = isPart ? gate(gateInputFor(frame, need, amountIn, partRead)) : fullGate;
  const plan = planOutcome({ decision: answer.decision, gate: finalGate, override: null, isPart: isPart || need.limitedByPerAction, mode: frame.desk.mode, largeActionE6: frame.mandate.largeActionE6 });
  const wanted = plan.willAct || plan.outcome === "ASKED" || plan.outcome === "WOULD_HAVE_ACTED";
  const preview = wanted ? { amountIn, expectedOut: partRead.quote?.outAmount ?? 0n, slippageBps: SLIPPAGE_BPS, deadlineSec: plan.willAct ? frame.nowSec + DEADLINE_SEC : null } : null;
  const facts = { decidedAtSec: frame.nowSec, premiumBps: read.market.premiumBps, spotE8: read.market.spotE8.toString(), driftBps: need.driftBps, cashE6: frame.standing.cashE6.toString() };
  const considered: Considered = {
    need, market: partRead.market, quote: partRead.quote, reference: partRead.reference, pack, gate: finalGate, blockers, answer, outcome: plan.outcome, ask: plan.ask, willAct: plan.willAct, override: null, summary: "", preview, deferral,
    newDeferralBaseline: plan.outcome === "WAITED" && answer.decision?.option === "WAIT" ? { kind: "wait", ...facts } : plan.outcome === "WOULD_HAVE_ACTED" ? { kind: "would_have", ...facts } : null,
  };
  return { ...considered, summary: summaryOf(considered, frame.nowSec) };
}
