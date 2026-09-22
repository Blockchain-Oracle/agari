import * as dbModule from "@agari/db";
import { getDb, type Db } from "@agari/db";
import { OUTCOME_COLUMN, type DeskMandateWire, type DeskMode } from "@agari/core/desk";
import type { Hash32 } from "@agari/core/types";
import type { ApprovalWire, ChainStateWire, DeskRowWire, DeskViewWire, GradeWire, MandateVersionWire, RecordSummaryWire, SnapshotWire } from "./protocol";

/**
 * THE ONE FILE that talks to the desk's database (S21 C5 ↔ C4). C4 ships `deskQueries(db)` in `@agari/db`; this
 * file declares the contract it was written against, resolves the factory at runtime (so the web builds and answers
 * an honest 503 until C4 merges), and maps every row to the wire shape in `protocol.ts` with tolerant coercion. A
 * mismatch at the merge is fixed here and nowhere else.
 */
export interface DeskQueries {
  getDeskByOwner(cluster: string, owner: string): Promise<DbDesk | null>;
  getDeskById(id: string): Promise<DbDesk | null>;
  createPracticeDesk(i: { owner: string; cluster: string; mandateBody: DeskMandateWire; fingerprint: Hash32; signer: string; signature: string; cashE6?: bigint }): Promise<DbDesk>;
  attachLiveDesk(i: { deskId: string; address: string; operator: string; mode: DeskMode }): Promise<void>;
  setDeskMode(i: { deskId: string; mode: DeskMode }): Promise<void>;
  setSharePublic(i: { deskId: string; on: boolean }): Promise<void>;
  markRecordOpened(i: { deskId: string; nowSec: number }): Promise<void>;
  applyMandate(i: { deskId: string; body: DeskMandateWire; fingerprint: Hash32; signer: string; signature: string; nowSec: number }): Promise<number>;
  currentMandate(deskId: string): Promise<DbMandate | null>;
  listRecords(i: { deskId: string; limit: number; beforeSeq?: number }): Promise<DbRecord[]>;
  getRecord(i: { deskId: string; seq: number }): Promise<{ record: DbRecord & { body: unknown }; actions: DbAction[]; grade: DbGrade | null } | null>;
  listApprovals(i: { deskId: string; open?: boolean }): Promise<DbApproval[]>;
  answerApproval(i: { deskId: string; approvalId: string; answer: "approve" | "decline"; signer: string; signature: string; nowSec: number }): Promise<void>;
  requestCheckNow(i: { deskId: string; signer: string; signature: string; nowSec: number; trigger?: "check_now" | "test_read" }): Promise<{ ok: true } | { ok: false; throttledUntilSec: number }>;
  listPriceMarks(i: { symbol: string; fromSec: number; toSec: number }): Promise<unknown[]>;
  deskFeedSince(i: { deskId: string; sinceSeq: number }): Promise<DbFeedItem[]>;
  getPaper(deskId: string): Promise<DbPaper | null>;
  latestSnapshot(deskId: string): Promise<DbSnapshot | null>;
  listGrades(i: { deskId: string; limit: number }): Promise<DbGrade[]>;
  /** Beyond the C4 contract (flagged in the C5 report): the owner's two requests the operator must carry out. */
  requestOwnerAction?(i: { deskId: string; kind: "sell_all" | "close"; signer: string; signature: string; nowSec: number }): Promise<void>;
}

type Num = number | bigint | string;
export interface DbDesk { id: string; address: string | null; owner: string; cluster: string; mode: string; state: string; stateReason: string | null; chainSeq: Num; chainHead: string; mandateVersion: Num; practiceChecks: Num; recordOpenedAtSec: Num | null; sharePublic: boolean; createdAtSec: Num; updatedAtSec: Num }
export interface DbMandate { version: Num; body: DeskMandateWire; fingerprint: string; appliedAtSec?: Num; createdAtSec?: Num }
export interface DbRecord { seq: Num; prevHash: string; recordHash: string; outcome: string; summary: string; mode: string; decidedAtSec: Num; sealedBySig: string | null; sealedSeq: Num | null }
export interface DbAction { leg?: Num; kind: string; status: string; signature?: string | null; txSignature?: string | null; expectedOut?: Num | null; actualOut?: Num | null; failureCode?: string | null; failureDetail?: string | null }
export interface DbGrade { seq: Num; verdict: string; differenceBps: Num | null; countsForTiming?: boolean; why?: string }
export interface DbApproval { id: string; decisionSeq: Num; decisionHash: string; summary: string; reason: string; side?: string | null; symbol?: string | null; amountIn?: Num | null; expectedOut?: Num | null; confidencePercent?: Num | null; costBps?: Num | null; turnedDown?: string | null; expiresAtSec: Num; status: string; answeredAtSec?: Num | null; executionSeq?: Num | null }
export interface DbPaper { cashE6: Num; positions: Record<string, Num> }
export interface DbSnapshot { atSec: Num; totalE6: Num; cashE6: Num; baselineE6?: Num | null; holdings: Array<{ symbol: string; raw: Num; valueE6?: Num | null; weightBps: Num; targetBps: Num; driftBps: Num; premiumBps?: Num | null; priceE8?: Num | null; priceAgeSec?: Num | null; paused?: boolean; frozen?: boolean }> }
export interface DbFeedItem { kind?: string; seq: Num; outcome?: string | null; summary: string; atSec: Num }

type Factory = (db: Db) => DeskQueries;

/** The desk index, or null when this deployment has no database or C4's queries are not merged: routes answer 503. */
export function deskStore(): DeskQueries | null {
  const factory = (dbModule as unknown as { deskQueries?: Factory }).deskQueries;
  const db = getDb();
  return factory && db ? factory(db) : null;
}

const int = (v: Num | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
const intOrNull = (v: Num | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const digits = (v: Num | null | undefined): string => (v === null || v === undefined ? "0" : BigInt(v).toString());
const digitsOrNull = (v: Num | null | undefined): string | null => (v === null || v === undefined ? null : BigInt(v).toString());
const str = (v: Num | null | undefined): string | null => (v === null || v === undefined ? null : String(v));
const hash = (v: string): Hash32 => v.toLowerCase() as Hash32;
const OUTCOMES = new Set<string>(Object.values(OUTCOME_COLUMN));
const outcomeOf = (v: string): RecordSummaryWire["outcome"] => (OUTCOMES.has(v) ? (v as RecordSummaryWire["outcome"]) : OUTCOME_COLUMN[v as keyof typeof OUTCOME_COLUMN] ?? "failed");
const modeOf = (v: string): DeskMode => (v === "ask_first" || v === "on_its_own" ? v : "practice");

export const toDeskRow = (d: DbDesk): DeskRowWire => ({
  id: d.id, address: d.address, owner: d.owner, cluster: d.cluster, mode: modeOf(d.mode),
  state: (["active", "paused_by_owner", "stopped_by_loss_limit", "needs_attention", "practice", "closed"].includes(d.state) ? d.state : "needs_attention") as DeskRowWire["state"],
  stateReason: d.stateReason, chainSeq: int(d.chainSeq), chainHead: d.chainHead, mandateVersion: int(d.mandateVersion), practiceChecks: int(d.practiceChecks),
  recordOpenedAtSec: intOrNull(d.recordOpenedAtSec), sharePublic: Boolean(d.sharePublic), createdAtSec: int(d.createdAtSec), updatedAtSec: int(d.updatedAtSec),
});

/** A visitor never reads the owner's notes (plan §5.4): they leave as an empty string, never as the text. */
export const toMandate = (m: DbMandate, viewer: "owner" | "visitor"): MandateVersionWire => ({
  version: int(m.version), body: viewer === "owner" ? m.body : { ...m.body, notes: "" }, fingerprint: hash(m.fingerprint), appliedAtSec: int(m.appliedAtSec ?? m.createdAtSec),
});

export const toRecord = (r: DbRecord): RecordSummaryWire => ({
  seq: int(r.seq), prevHash: hash(r.prevHash), recordHash: hash(r.recordHash), outcome: outcomeOf(r.outcome), summary: r.summary, mode: modeOf(r.mode),
  decidedAtSec: int(r.decidedAtSec), sealedBySig: r.sealedBySig, sealedSeq: intOrNull(r.sealedSeq),
});

export const toGrade = (g: DbGrade): GradeWire => ({
  seq: int(g.seq), verdict: (["better", "worse", "no_real_difference", "ungradable"].includes(g.verdict) ? g.verdict : "ungradable") as GradeWire["verdict"],
  differenceBps: intOrNull(g.differenceBps), countsForTiming: g.countsForTiming ?? g.verdict !== "ungradable", why: g.why ?? "",
});

export const toApproval = (a: DbApproval): ApprovalWire => ({
  id: a.id, decisionSeq: int(a.decisionSeq), decisionHash: hash(a.decisionHash), summary: a.summary, reason: a.reason === "large_action" ? "large_action" : "ask_first",
  side: a.side === "sell" ? "sell" : a.side === "buy" ? "buy" : null, symbol: (a.symbol as ApprovalWire["symbol"]) ?? null,
  amountIn: str(a.amountIn), expectedOut: str(a.expectedOut), confidencePercent: intOrNull(a.confidencePercent), costBps: intOrNull(a.costBps), turnedDown: a.turnedDown ?? null,
  expiresAtSec: int(a.expiresAtSec), status: (["open", "approved", "declined", "expired", "cancelled"].includes(a.status) ? a.status : "open") as ApprovalWire["status"],
  answeredAtSec: intOrNull(a.answeredAtSec), executionSeq: intOrNull(a.executionSeq),
});

export const toSnapshot = (s: DbSnapshot): SnapshotWire => ({
  atSec: int(s.atSec), totalE6: digits(s.totalE6), cashE6: digits(s.cashE6), baselineE6: digitsOrNull(s.baselineE6),
  holdings: s.holdings.map((h) => ({
    symbol: h.symbol as SnapshotWire["holdings"][number]["symbol"], raw: digits(h.raw), valueE6: digitsOrNull(h.valueE6), weightBps: int(h.weightBps), targetBps: int(h.targetBps), driftBps: int(h.driftBps),
    premiumBps: intOrNull(h.premiumBps), priceE8: digitsOrNull(h.priceE8), priceAgeSec: intOrNull(h.priceAgeSec), paused: Boolean(h.paused), frozen: Boolean(h.frozen),
  })),
});

/** The desk by its owner's address or by its id: `/desk/[id]` accepts both, and so does every route. */
export async function findDesk(store: DeskQueries, key: string, isAddress: boolean): Promise<DbDesk | null> {
  return isAddress ? store.getDeskByOwner(DESK_CLUSTER_ID, key) : store.getDeskById(key);
}
const DESK_CLUSTER_ID = "mainnet-beta";

/** Approvals still waiting, plus the ones that expired unanswered in the last day (the page says so). */
async function approvalsFor(store: DeskQueries, deskId: string, nowSec: number): Promise<ApprovalWire[]> {
  const rows = (await store.listApprovals({ deskId })).map(toApproval);
  return rows.filter((a) => a.status === "open" || (a.status === "expired" && a.answeredAtSec === null && a.expiresAtSec > nowSec - 86_400)).sort((a, b) => b.decisionSeq - a.decisionSeq);
}

/** The plate's Timing line (core `timingSum` over the wire grades): counted grades' basis points, and how many. */
export function timingOf(grades: readonly GradeWire[]): { bps: number; graded: number } {
  const counted = grades.filter((g) => g.countsForTiming && g.differenceBps !== null);
  return { bps: counted.reduce((sum, g) => sum + (g.differenceBps as number), 0), graded: counted.length };
}

export interface ViewInput {
  store: DeskQueries;
  desk: DbDesk | null;
  viewer: "owner" | "visitor";
  nowSec: number;
  chain: { state: ChainStateWire | null; error: string | null };
  operator: string | null;
}

/** Everything the desk page shows, in one answer (plan §5.7); a visitor gets the same minus the notes. */
export async function assembleView(i: ViewInput): Promise<DeskViewWire> {
  const base = { configured: true as const, viewer: i.viewer, chain: i.chain.state, chainError: i.chain.error, operator: i.operator, nowSec: i.nowSec };
  if (!i.desk) return { ...base, desk: null, mandate: null, snapshot: null, paper: null, approvals: [], latest: null, recent: [], timing: { bps: 0, graded: 0 } };
  const deskId = i.desk.id;
  const [mandate, snapshot, paper, approvals, recent, grades] = await Promise.all([
    i.store.currentMandate(deskId),
    i.store.latestSnapshot(deskId),
    i.store.getPaper(deskId),
    approvalsFor(i.store, deskId, i.nowSec),
    i.store.listRecords({ deskId, limit: 12 }),
    i.store.listGrades({ deskId, limit: 500 }),
  ]);
  const records = recent.map(toRecord);
  return {
    ...base,
    desk: toDeskRow(i.desk),
    mandate: mandate ? toMandate(mandate, i.viewer) : null,
    snapshot: snapshot ? toSnapshot(snapshot) : null,
    paper: paper ? { cashE6: digits(paper.cashE6), positions: Object.fromEntries(Object.entries(paper.positions).map(([s, v]) => [s, digits(v)])) } : null,
    approvals,
    latest: records[0] ?? null,
    recent: records,
    timing: timingOf(grades.map(toGrade)),
  };
}
