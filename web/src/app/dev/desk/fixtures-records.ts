/**
 * Canned records for `/dev/desk` (S21): one schema-valid `desk.v1` body per outcome, hashed with the real `hashRecord`
 * so Check it passes on them and fails on the tampered copy; the record list with a folded quiet run; a decision wire
 * of each kind of proof. Nothing here is a real transaction.
 */
import { deskRecordSchema, hashRecord, OUTCOME_COLUMN, PLANNED_OUTCOMES, ZERO_HASH, type DeskRecordBody, type PlannedOutcome } from "@agari/core/desk";
import type { Hash32 } from "@agari/core/types";
import type { DecisionWire, ProofWire, RecordSummaryWire } from "@/features/desk/protocol";
import { fixtureAddress, fixtureSignature } from "../fixture-ids";

export const NOW_SEC = 1_790_101_000; // 2026-09-22 18:23:20Z
export const OWNER = fixtureAddress("0x5e1f5e1f5e1f5e1f5e1f5e1f5e1f5e1f5e1f5e1f");
export const DESK_ID = "desk-fixture-ailabs";
export const DESK_ADDRESS = fixtureAddress("0xde5cde5cde5cde5cde5cde5cde5cde5cde5cde5c");
export const OPERATOR = fixtureAddress("0x0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b");
const OPENAI_MINT = "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF";
const ANTHROPIC_MINT = "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw";
export const MANDATE_FINGERPRINT = `0x${"a1".repeat(32)}` as const;
const iso = (sec: number) => new Date(sec * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

const holding = (symbol: "OPENAI" | "ANTHROPIC", mint: string, balance: string, price: string, mark: string, value: string, weightBps: number, targetBps: number, premiumBps: number) => ({
  symbol, mint, balance, price, spot: price, mark, value, weightBps, targetBps, driftBps: weightBps - targetBps, premiumBps, paused: false, frozen: false,
});

const VALUATION: NonNullable<DeskRecordBody["valuation"]> = {
  priceSource: "prestocks_mean_30m",
  total: "1004.2",
  cash: "212.4",
  cashWeightBps: 2115,
  cashTargetBps: 2000,
  holdings: [holding("OPENAI", OPENAI_MINT, "4.2", "115.51865677", "100.32", "485.17", 4831, 4000, 1512), holding("ANTHROPIC", ANTHROPIC_MINT, "2.93", "104.64276840", "101.90", "306.6", 3053, 4000, 269)],
  unpriced: [],
};

/** The price row's spot and mean follow the premium, so a fixture never says "15.1% above its mark" over a 2.7% gap. */
const EVIDENCE = (premiumBps: number, costBps: number | null, spot = "104.64276840", mean30m = "104.51"): DeskRecordBody["evidence"] => [
  { id: "e1", kind: "session", market: "24/7", at: iso(NOW_SEC - 1400), trigger: "hourly", nextCheck: iso(NOW_SEC + 2200) },
  { id: "e2", kind: "price", spot, mean30m, gapBps: 13, inLine: true, mark: "101.90", premiumBps, index: null, indexPremiumBps: null, referenceAgeSec: 41, multiplier: "1" },
  { id: "e3", kind: "cost", costBps, transferFeeBps: 100, quoteOut: costBps === null ? null : "0.4718", quoteOutUnit: "ANTHROPIC", routeAccounts: costBps === null ? null : 14 },
  { id: "e4", kind: "status", mintPaused: false, accountFrozen: false, deskPaused: false, referenceFresh: true },
  { id: "e5", kind: "limits", perActionCap: "50", remainingToday: "150", deskCash: "212.4", deskHolds: "306.6", countsAgainstLimits: "50" },
  { id: "e6", kind: "position", weightBps: 3053, targetBps: 4000, driftBps: -947, thresholdBps: 550 },
  { id: "e7", kind: "recent", lastOnThisNameIso: null, lastOutcome: null, minutesSince: null, standingWait: null },
];

const CANDIDATE: NonNullable<DeskRecordBody["candidate"]> = { id: "c1", side: "buy", symbol: "ANTHROPIC", mint: ANTHROPIC_MINT, amountIn: "50", amountInUnit: "USDC", why: "Anthropic is 30.5% of the desk against a target of 40.0%. That is further than the 5.5% it may wander.", protective: false };
const NEED = { driftBps: -947, thresholdBps: 550, limitedByPerActionLimit: true };
const timing = (option: "ACT_NOW" | "ACT_PART" | "WAIT" | "DECLINE", headline: string, partPercent: 25 | 50 | 75 | null = null): NonNullable<DeskRecordBody["timing"]> => ({
  promptVersion: "desk-timing.v1", model: "anthropic/claude-sonnet-5", latencyMs: 1840, totalTokens: 1210, finishReason: "stop", error: null, rejectedByOurChecks: [], styleWordsUsed: [],
  decision: {
    option, partPercent, headline, confidencePercent: 71,
    reasons: [{ text: "Anthropic sits 2.7% above its mark, inside the 10% ceiling, and the quote at this size costs 1.3% all in.", evidenceIds: ["e2", "e3"] }],
    rejected: option === "WAIT" ? [{ option: "ACT_NOW", reason: "The drift is real but the price has moved 1.3% in the hour; an hour of patience costs little." }] : [{ option: "WAIT", reason: "Nothing measurable is expected to change before the next check." }],
    premiumRead: "fair", waitFor: option === "WAIT" ? "the spot to settle within its half-hour average" : null, warnings: [], ruleIds: [],
  },
});
const GATE_OK: NonNullable<DeskRecordBody["gate"]> = { result: "allow", reasons: [], counted: "50", oracleValue: "50", oracleFloor: "0.43929", premiumOk: true };
const GATE_NO: NonNullable<DeskRecordBody["gate"]> = { result: "deny", reasons: ["over what is left of the daily limit"], counted: "50", oracleValue: "50", oracleFloor: "0.43929", premiumOk: true };
const PREVIEW: NonNullable<DeskRecordBody["preview"]> = { amountIn: "50", expectedOut: "0.4718", minOut: "0.46944", slippageBps: 50, deadlineSec: NOW_SEC + 90 };

export function baseBody(seq: number, decidedAtSec: number, mode: DeskRecordBody["mode"] = "practice"): DeskRecordBody {
  return {
    schemaVersion: "desk.v1", kind: "decision", chainId: 101, desk: OWNER, seq, prevHash: seq === 1 ? ZERO_HASH : hashOf(seq - 1), chain: { seqBefore: 0, headBefore: ZERO_HASH },
    decidedAt: iso(decidedAtSec), wake: { scheduledFor: iso(decidedAtSec), trigger: "hourly" }, mode, mandate: { version: 1, fingerprint: MANDATE_FINGERPRINT },
    valuation: VALUATION, need: null, candidate: null, deferral: null, approvalOf: null, blockers: [], evidence: [], timing: null, gate: null, override: null, outcome: "NOTHING_TO_DO", ask: null, preview: null,
    paper: mode === "practice" ? { cash: "212.4", positions: { OPENAI: "2.826", ANTHROPIC: "2.93" } } : null,
  };
}
const hashes = new Map<number, `0x${string}`>();
function hashOf(seq: number): `0x${string}` {
  return hashes.get(seq) ?? ZERO_HASH;
}

/** The body of each outcome, in plan §5.9's terms; the summary is the desk's first-person line for the list. */
export const OUTCOME_BODIES: Record<PlannedOutcome, (b: DeskRecordBody) => { body: DeskRecordBody; summary: string }> = {
  NOTHING_TO_DO: (b) => ({ body: { ...b, evidence: EVIDENCE(269, null).slice(0, 1) }, summary: "I checked. Nothing to do: every holding is within its range." }),
  WAITED: (b) => ({ body: { ...b, need: NEED, candidate: CANDIDATE, evidence: EVIDENCE(269, 130), timing: timing("WAIT", "Wait: the spot is 1.3% off its half-hour average; the drift will still be there in an hour."), gate: GATE_OK, outcome: "WAITED" }, summary: "I waited. The price of Anthropic is 1.3% away from its own average of the last half hour. I will look again when that changes, or at the next check." }),
  WOULD_HAVE_ACTED: (b) => ({ body: { ...b, need: NEED, candidate: CANDIDATE, evidence: EVIDENCE(269, 130), timing: timing("ACT_NOW", "Act now: the premium is fair and the cost is inside the limit."), gate: GATE_OK, outcome: "WOULD_HAVE_ACTED", preview: PREVIEW }, summary: "I would have bought $50 of Anthropic. Anthropic is 30.5% of the desk against a target of 40.0%." }),
  ACTED: (b) => ({ body: { ...b, mode: "on_its_own", paper: null, chain: { seqBefore: 7, headBefore: `0x${"7b".repeat(32)}` }, need: NEED, candidate: CANDIDATE, evidence: EVIDENCE(269, 130), timing: timing("ACT_NOW", "Act now: the premium is fair and the cost is inside the limit."), gate: GATE_OK, outcome: "ACTED", preview: PREVIEW }, summary: "I bought $50 of Anthropic. Anthropic is 30.5% of the desk against a target of 40.0%. It cost $0.65 in fees: PreStocks' 1% and the route's." }),
  ACTED_IN_PART: (b) => ({ body: { ...b, mode: "on_its_own", paper: null, need: NEED, candidate: CANDIDATE, evidence: EVIDENCE(269, 130), timing: timing("ACT_PART", "Do half now: the premium is fair but the route is thin at the full size.", 50), gate: GATE_OK, outcome: "ACTED_IN_PART", preview: { ...PREVIEW, amountIn: "25", expectedOut: "0.2359", minOut: "0.23472" } }, summary: "I bought $25 of Anthropic, half of what arithmetic asked for. The route was thin at the full size." }),
  ACTED_BY_OVERRIDE: (b) => ({ body: { ...b, mode: "on_its_own", paper: null, need: NEED, candidate: CANDIDATE, evidence: EVIDENCE(269, 130), timing: timing("WAIT", "Wait: the spot is off its average."), gate: GATE_OK, override: { by: "the owner", reason: "You pressed Do it now on the desk page." }, outcome: "ACTED_BY_OVERRIDE", preview: PREVIEW }, summary: "I bought $50 of Anthropic on your call. I had chosen to wait." }),
  ASKED: (b) => ({ body: { ...b, mode: "ask_first", paper: null, need: NEED, candidate: CANDIDATE, evidence: EVIDENCE(269, 130), timing: timing("ACT_NOW", "Act now: the premium is fair and the cost is inside the limit."), gate: GATE_OK, outcome: "ASKED", ask: "ask_first", preview: PREVIEW }, summary: "I asked you: buy $50 of Anthropic. Expires 19:00 UTC." }),
  DECLINED: (b) => ({ body: { ...b, need: NEED, candidate: CANDIDATE, evidence: EVIDENCE(1512, 130, "117.30728000", "117.12"), timing: timing("DECLINE", "Do not do it: the whole drift comes from OpenAI's premium, not from Anthropic being cheap."), gate: GATE_OK, outcome: "DECLINED" }, summary: "I decided not to act on Anthropic. The whole drift comes from OpenAI's premium, not from Anthropic being cheap." }),
  BLOCKED_BY_LIMIT: (b) => ({ body: { ...b, need: NEED, candidate: CANDIDATE, evidence: EVIDENCE(269, 130), timing: timing("ACT_NOW", "Act now: the premium is fair."), gate: GATE_NO, outcome: "BLOCKED_BY_LIMIT" }, summary: "I wanted to act, and a limit stopped me: over what is left of the daily limit." }),
  NOT_EXECUTED: (b) => ({ body: { ...b, kind: "execution", mode: "ask_first", paper: null, need: NEED, candidate: CANDIDATE, evidence: EVIDENCE(269, 130), approvalOf: { decisionSeq: 8, askedBecause: "ask_first", answeredAt: iso(NOW_SEC - 600), movedBps: 340 }, gate: GATE_OK, outcome: "NOT_EXECUTED", preview: PREVIEW }, summary: "You approved it, but I did not act: the price had moved 3.4% since I showed it to you." }),
  FAILED_NO_DECISION: (b) => ({ body: { ...b, need: NEED, candidate: CANDIDATE, evidence: EVIDENCE(269, 130), timing: { ...timing("WAIT", "x"), error: "the model did not answer within 30 s", decision: null }, outcome: "FAILED_NO_DECISION" }, summary: "I could not decide: the model did not answer within 30 s." }),
};

export interface FixtureRecord {
  body: DeskRecordBody;
  summary: RecordSummaryWire;
}

/** Records 1..12, newest first: 12 asked, 11..6 a quiet run, 5 would-have, 4 blocked, 3..1 a quiet run. */
const PLAN: PlannedOutcome[] = ["NOTHING_TO_DO", "NOTHING_TO_DO", "WAITED", "BLOCKED_BY_LIMIT", "WOULD_HAVE_ACTED", "NOTHING_TO_DO", "NOTHING_TO_DO", "WAITED", "NOTHING_TO_DO", "NOTHING_TO_DO", "NOTHING_TO_DO", "ASKED"];
export const RECORDS: FixtureRecord[] = PLAN.map((outcome, i) => {
  const seq = i + 1;
  const decidedAtSec = NOW_SEC - (12 - seq) * 3_600 - 1400;
  const made = OUTCOME_BODIES[outcome](baseBody(seq, decidedAtSec));
  const body = deskRecordSchema.parse({ ...made.body, seq, prevHash: seq === 1 ? ZERO_HASH : hashOf(seq - 1), decidedAt: iso(decidedAtSec), wake: { scheduledFor: iso(decidedAtSec), trigger: "hourly" }, mode: "practice", paper: made.body.paper ?? { cash: "212.4", positions: {} } });
  const recordHash = hashRecord(body);
  hashes.set(seq, recordHash);
  return { body, summary: { seq, prevHash: body.prevHash as Hash32, recordHash, outcome: OUTCOME_COLUMN[outcome], summary: made.summary, mode: "practice" as const, decidedAtSec, sealedBySig: null, sealedSeq: null } };
}).reverse();

/** One decision wire per outcome, for the nine sections; live outcomes carry an "own" proof with a fixture signature. */
export function decisionOf(outcome: PlannedOutcome, viewer: "owner" | "visitor" = "owner"): DecisionWire {
  const seq = 20 + PLANNED_OUTCOMES.indexOf(outcome);
  const made = OUTCOME_BODIES[outcome](baseBody(seq, NOW_SEC - 1400, outcome === "WOULD_HAVE_ACTED" || outcome === "NOTHING_TO_DO" ? "practice" : "on_its_own"));
  const body = deskRecordSchema.parse(made.body);
  const recordHash = hashRecord(body);
  const live = body.mode !== "practice";
  const signature = fixtureSignature(seq);
  const proof: ProofWire = !live ? { kind: "practice" } : outcome === "ASKED" ? { kind: "unsealed", deskAddress: DESK_ADDRESS } : { kind: "own", signature, deskAddress: DESK_ADDRESS };
  const acted = outcome === "ACTED" || outcome === "ACTED_IN_PART" || outcome === "ACTED_BY_OVERRIDE";
  return {
    record: { seq, prevHash: body.prevHash as Hash32, recordHash, outcome: OUTCOME_COLUMN[outcome], summary: made.summary, mode: body.mode, decidedAtSec: NOW_SEC - 1400, sealedBySig: live && outcome !== "ASKED" ? signature : null, sealedSeq: live && outcome !== "ASKED" ? seq : null, body },
    actions: acted ? [{ leg: 1, kind: "Bought", status: "confirmed", signature, expectedOut: "0.4718", actualOut: "0.4702", failureCode: null, failureDetail: null }] : outcome === "FAILED_NO_DECISION" ? [] : [],
    grade: outcome === "WAITED" ? { seq, verdict: "better", differenceBps: 140, countsForTiming: true, why: "Waiting a day came out better than acting then." } : acted ? { seq, verdict: "worse", differenceBps: -60, countsForTiming: true, why: "Waiting a day would have come out better." } : null,
    approval: outcome === "ASKED" ? { id: "apr-fixture-open", decisionSeq: seq, decisionHash: recordHash, summary: "buy $50 of Anthropic", reason: "ask_first", side: "buy", symbol: "ANTHROPIC", amountIn: "50", expectedOut: "0.4718", confidencePercent: 71, costBps: 130, turnedDown: "Wait: nothing measurable is expected to change before the next check.", expiresAtSec: NOW_SEC + 2_200, status: "open", answeredAtSec: null, executionSeq: null } : null,
    proof,
    viewer,
  };
}

/** The same body with one byte changed in the summary the desk wrote: Check it must fail on it. */
export const TAMPERED = (() => {
  const good = RECORDS.find((r) => r.summary.outcome === "would_have_acted")!;
  const body = { ...good.body, candidate: good.body.candidate ? { ...good.body.candidate, amountIn: "500" } : null };
  return { body, recordHash: good.summary.recordHash, honest: good };
})();
