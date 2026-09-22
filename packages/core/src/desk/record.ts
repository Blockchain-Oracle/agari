/**
 * Assembles the hashed body of a decision record (desk.md §6). Pure and quick, because it runs while the desk lock is
 * held: every fact was gathered beforehand. Strings, safe integers, booleans and null only; `hashRecord` refuses the
 * rest, and the strict `desk.v1` schema refuses a shape drift before anything is hashed or sent.
 */
import type { Hash32 } from "../types/primitives";
import type { DeskGateResult } from "./gate";
import { hashRecord, ZERO_HASH } from "./hashing";
import { mandateToWire, type DeskMandate } from "./mandate";
import type { DeskNeed } from "./needs";
import { paperLedgerToWire, type PaperLedger } from "./paper";
import type { AskReason, DeskMode, Override, PlannedOutcome } from "./plan";
import type { Blocker } from "./pregate";
import { deskRecordSchema, RECORD_SCHEMA_VERSION, type DeskRecordBody } from "./record-schema";
import type { DeskTiming } from "./timing";
import { formatPriceE8, formatTokens, formatUsdc } from "./units";
import type { DeskValuation } from "./valuation";

export { RECORD_SCHEMA_VERSION };

/** A mandate's fingerprint: the wire form's canonical hash, so a record commits to the exact instructions it was made under. */
export function mandateFingerprint(m: DeskMandate): Hash32 {
  return hashRecord(mandateToWire(m));
}

/** What the brain returns for one question: the provider's answer and our own checks over it (`brain/desk-decide.ts`). */
export interface DeskTimingAnswer {
  promptVersion: string;
  model: string;
  latencyMs: number;
  totalTokens: number | null;
  finishReason: string | null;
  /** The provider's failure, or null when it answered. */
  error: string | null;
  /** Why our own checks rejected an answer the provider returned as fine. Empty when it passed or when the provider failed. */
  problems: string[];
  styleWords: string[];
  /** The parsed answer when the provider answered, whether or not our checks passed. */
  raw: DeskTiming | null;
  /** Present only when the provider answered AND our checks passed. */
  decision: DeskTiming | undefined;
}

export interface ApprovalOf {
  decisionSeq: number;
  askedBecause: "ask_first" | "large_action" | "owner_override";
  answeredAtIso: string;
  movedBps: number;
}

export interface DecisionBodyInput {
  chainId: number;
  owner: string;
  slot: { seq: number; prevHash: Hash32 };
  /** The program's counter and head before this record; zeros for a practice desk. */
  chain: { seqBefore: number; headBefore: Hash32 };
  decidedAtIso: string;
  wake: { scheduledForIso: string; trigger: string };
  mode: DeskMode;
  mandate: { version: number; fingerprint: Hash32 } | null;
  valuation: DeskValuation | null;
  need: DeskNeed | null;
  /** A remembered wait that this record continues, ends, or that ended just before it. */
  deferral: { decisionSeq: number; decidedAtIso: string; stillStanding: boolean; endedBecause: string | null } | null;
  blockers: Blocker[];
  evidence: Record<string, unknown>[];
  answer: DeskTimingAnswer | null;
  gate: DeskGateResult | null;
  override: Override | null;
  outcome: PlannedOutcome;
  ask: AskReason | null;
  /** Set only on an execution record: the request the owner approved, and how far the price moved since. */
  approvalOf: ApprovalOf | null;
  /** Present only when the desk acts, would have acted, or asks. */
  preview: { amountIn: bigint; expectedOut: bigint; slippageBps: number; deadlineSec: number | null } | null;
  /** The practice ledger after this check; null on a live desk. */
  paper: PaperLedger | null;
}

export function buildDecisionBody(i: DecisionBodyInput): DeskRecordBody {
  const c = i.need?.candidate ?? null;
  const fmtIn = c?.side === "sell" ? formatTokens : formatUsdc;
  const fmtOut = c?.side === "sell" ? formatUsdc : formatTokens;
  const v = i.valuation;
  const a = i.answer;
  const body = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    kind: i.approvalOf ? "execution" : "decision",
    chainId: i.chainId,
    desk: i.owner,
    seq: i.slot.seq,
    prevHash: i.slot.prevHash,
    chain: { seqBefore: i.chain.seqBefore, headBefore: i.chain.headBefore },
    decidedAt: i.decidedAtIso,
    wake: { scheduledFor: i.wake.scheduledForIso, trigger: i.wake.trigger },
    mode: i.mode,
    mandate: i.mandate,
    valuation: v
      ? {
          priceSource: "prestocks_mean_30m",
          total: formatUsdc(v.totalE6),
          cash: formatUsdc(v.cashE6),
          cashWeightBps: v.cashWeightBps,
          cashTargetBps: v.cashTargetBps,
          holdings: v.holdings.map((h) => ({
            symbol: h.symbol,
            mint: h.mint,
            balance: formatTokens(h.raw),
            price: formatPriceE8(h.priceE8),
            spot: h.spotE8 === null ? null : formatPriceE8(h.spotE8),
            mark: h.markE8 === null ? null : formatPriceE8(h.markE8),
            value: formatUsdc(h.valueE6),
            weightBps: h.weightBps,
            targetBps: h.targetBps,
            driftBps: h.driftBps,
            premiumBps: h.premiumBps,
            paused: h.paused,
            frozen: h.frozen,
          })),
          unpriced: v.unpriced.map((u) => ({ symbol: u.symbol, mint: u.mint, balance: formatTokens(u.raw), why: u.why })),
        }
      : null,
    need: i.need ? { driftBps: i.need.driftBps, thresholdBps: i.need.thresholdBps, limitedByPerActionLimit: i.need.limitedByPerAction } : null,
    candidate: c ? { id: c.id, side: c.side, symbol: c.symbol, mint: c.mint, amountIn: fmtIn(c.amountIn), amountInUnit: c.side === "buy" ? "USDC" : c.symbol, why: c.why, protective: c.protective } : null,
    deferral: i.deferral ? { decisionSeq: i.deferral.decisionSeq, decidedAt: i.deferral.decidedAtIso, stillStanding: i.deferral.stillStanding, endedBecause: i.deferral.endedBecause } : null,
    approvalOf: i.approvalOf ? { decisionSeq: i.approvalOf.decisionSeq, askedBecause: i.approvalOf.askedBecause, answeredAt: i.approvalOf.answeredAtIso, movedBps: i.approvalOf.movedBps } : null,
    blockers: i.blockers.map((b) => ({ rule: b.rule, text: b.text })),
    evidence: i.evidence,
    timing: a
      ? {
          promptVersion: a.promptVersion,
          model: a.model,
          latencyMs: a.latencyMs,
          totalTokens: a.totalTokens,
          finishReason: a.finishReason,
          error: a.error,
          rejectedByOurChecks: a.problems,
          styleWordsUsed: a.styleWords,
          decision: a.raw,
        }
      : null,
    gate: i.gate
      ? { result: i.gate.result, reasons: i.gate.reasons, counted: formatUsdc(i.gate.countedE6), oracleValue: formatUsdc(i.gate.oracleValueE6), oracleFloor: fmtOut(i.gate.oracleFloor), premiumOk: i.gate.premiumOk }
      : null,
    override: i.override,
    outcome: i.outcome,
    ask: i.ask,
    preview:
      i.preview && i.gate
        ? { amountIn: fmtIn(i.preview.amountIn), expectedOut: fmtOut(i.preview.expectedOut), minOut: fmtOut(i.gate.minOut), slippageBps: i.preview.slippageBps, deadlineSec: i.preview.deadlineSec }
        : null,
    paper: i.paper ? { cash: formatUsdc(i.paper.cashE6), positions: Object.fromEntries(Object.entries(paperLedgerToWire(i.paper).positions).map(([s, raw]) => [s, formatTokens(BigInt(raw as string))])) } : null,
  };
  return deskRecordSchema.parse(body);
}

/** A record and its fingerprint, the pair the runner stores and sends. */
export function sealRecord(body: DeskRecordBody): { body: DeskRecordBody; hash: Hash32 } {
  return { body: deskRecordSchema.parse(body), hash: hashRecord(body) };
}

/** The genesis for a desk's chain: no record yet. */
export const GENESIS_SLOT = { seq: 1, prevHash: ZERO_HASH } as const;
