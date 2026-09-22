/**
 * Appending to a desk's record and reading it back (desk.md §6), plus the rows that live beside a record: the
 * actions it sent, the remembered waits it opened. Two rules live here and nowhere else:
 *   1. `seq` is gap-free and `prev_hash` links each record to the one before it, both decided INSIDE a transaction
 *      holding `pg_advisory_xact_lock` for that desk, so two writers can never fork the chain.
 *   2. What is stored is what was hashed: the row is read back and re-hashed before commit.
 * The body is hashed with core's RFC 8785 canonical bytes (`hashRecord`), the same function "Check it" runs.
 */
import { hashRecord, verifyRecord, ZERO_HASH } from "@agari/core/desk";
import type { Db } from "./client";
import { storageKey } from "./keys";
import { ensureSchema } from "./migrate";

export interface RecordSlot {
  seq: number;
  prevHash: string;
}

export interface RecordListRow {
  seq: number;
  prevHash: string;
  recordHash: string;
  outcome: string;
  summary: string;
  mode: string;
  symbol: string | null;
  side: "buy" | "sell" | null;
  decidedAtSec: number;
  sealedBySig: string | null;
  sealedSeq: number | null;
}

export interface RecordRow extends RecordListRow {
  deskId: string;
  body: Record<string, unknown>;
  wakeId: string | null;
}

export type ActionKind = "buy" | "sell" | "checkpoint" | "post_ref";
export type ActionState = "attempting" | "confirmed" | "reverted" | "refused" | "unknown";

export interface ActionRow {
  id: string;
  deskId: string;
  recordSeq: number;
  kind: ActionKind;
  state: ActionState;
  signature: string | null;
  chainSeq: number | null;
  symbol: string | null;
  amountIn: string | null;
  expectedOut: string | null;
  minOut: string | null;
  amountOut: string | null;
  countedE6: string | null;
  deadlineSec: number | null;
  sentAtSec: number;
  confirmedAtSec: number | null;
  error: string | null;
}

export interface GradeRow {
  recordSeq: number;
  gradedAtSec: number;
  verdict: "better" | "worse" | "no_real_difference" | "ungradable";
  differenceBps: number | null;
  priceThenE8: string | null;
  priceLaterE8: string | null;
  chosen: string;
  alternative: string;
  why: string;
  countsForTiming: boolean;
}

export interface DeferralRow {
  id: number;
  symbol: string;
  kind: "wait" | "would_have";
  baseline: Record<string, unknown>;
  decisionSeq: number;
  revisitAtSec: number;
}

export class RecordChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordChainError";
  }
}

const NOTIFIED = ["ACTED", "ACTED_IN_PART", "ACTED_BY_OVERRIDE", "WOULD_HAVE_ACTED", "ASKED", "BLOCKED_BY_LIMIT", "FAILED_NO_DECISION", "NOT_EXECUTED"];

interface RawRecord {
  desk_id: string;
  seq: string;
  prev_hash: string;
  record_hash: string;
  body: Record<string, unknown>;
  outcome: string;
  summary: string;
  mode: string;
  symbol: string | null;
  side: "buy" | "sell" | null;
  decided_at_sec: string;
  wake_id: string | null;
  sealed_by_sig: string | null;
  sealed_seq: string | null;
}

interface RawAction {
  id: string;
  desk_id: string;
  record_seq: string;
  kind: ActionKind;
  state: ActionState;
  signature: string | null;
  chain_seq: string | null;
  symbol: string | null;
  amount_in: string | null;
  expected_out: string | null;
  min_out: string | null;
  amount_out: string | null;
  counted_e6: string | null;
  deadline_sec: string | null;
  sent_at_sec: string;
  confirmed_at_sec: string | null;
  error: string | null;
}

const num = (v: string | null): number | null => (v === null ? null : Number(v));
const toListRow = (r: RawRecord): RecordListRow => ({ seq: Number(r.seq), prevHash: r.prev_hash, recordHash: r.record_hash, outcome: r.outcome, summary: r.summary, mode: r.mode, symbol: r.symbol, side: r.side, decidedAtSec: Number(r.decided_at_sec), sealedBySig: r.sealed_by_sig, sealedSeq: num(r.sealed_seq) });
const toRecord = (r: RawRecord): RecordRow => ({ ...toListRow(r), deskId: r.desk_id, body: r.body, wakeId: r.wake_id });
const toAction = (r: RawAction): ActionRow => ({ id: r.id, deskId: r.desk_id, recordSeq: Number(r.record_seq), kind: r.kind, state: r.state, signature: r.signature, chainSeq: num(r.chain_seq), symbol: r.symbol, amountIn: r.amount_in, expectedOut: r.expected_out, minOut: r.min_out, amountOut: r.amount_out, countedE6: r.counted_e6, deadlineSec: num(r.deadline_sec), sentAtSec: Number(r.sent_at_sec), confirmedAtSec: num(r.confirmed_at_sec), error: r.error });


export interface AppendRecordInput {
  deskId: string;
  /** The finished body, or a builder that receives the slot (seq, prevHash) while the desk lock is held. */
  body: Record<string, unknown> | ((slot: RecordSlot) => Record<string, unknown>);
  privateNotes: Record<string, unknown> | null;
  outcome: string;
  summary: string;
  mode: string;
  symbol?: string | null;
  side?: "buy" | "sell" | null;
  wakeId: string | null;
  decidedAtSec: number;
  /** Rows that must exist if and only if this record does (an action, a deferral, an approval). Same transaction. */
  alongside?: (tx: Db, seq: number, hash: string) => Promise<void>;
}

export function deskRecordQueries(db: Db) {
  const ready = () => ensureSchema();
  /** The listing columns: everything but the body, which a list never opens. */
  const listColumns = () => db`desk_id, seq, prev_hash, record_hash, '{}'::jsonb AS body, outcome, summary, mode, symbol, side, decided_at_sec, wake_id, sealed_by_sig, sealed_seq`;
  return {
    async appendRecord(i: AppendRecordInput): Promise<{ seq: number; hash: string }> {
      await ready();
      return db.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext(${i.deskId}))`;
        const [last] = await tx<{ seq: string; record_hash: string }[]>`SELECT seq, record_hash FROM desk_records WHERE desk_id = ${i.deskId}::uuid ORDER BY seq DESC LIMIT 1`;
        const slot: RecordSlot = { seq: (last ? Number(last.seq) : 0) + 1, prevHash: last?.record_hash ?? ZERO_HASH };
        const body = typeof i.body === "function" ? i.body(slot) : i.body;
        if (body.seq !== slot.seq) throw new RecordChainError(`record body has seq ${String(body.seq)}, the chain expects ${slot.seq}`);
        if (String(body.prevHash).toLowerCase() !== slot.prevHash.toLowerCase()) throw new RecordChainError(`record body has prevHash ${String(body.prevHash)}, the chain expects ${slot.prevHash}`);
        const hash = hashRecord(body);
        const inserted = await tx<{ body: Record<string, unknown> }[]>`
          INSERT INTO desk_records (desk_id, seq, prev_hash, record_hash, body, private_notes, outcome, summary, mode, symbol, side, decided_at_sec, wake_id)
          VALUES (${i.deskId}::uuid, ${slot.seq}, ${slot.prevHash}, ${hash}, ${tx.json(body as never)}, ${tx.json((i.privateNotes ?? null) as never)}, ${i.outcome}, ${i.summary}, ${i.mode}, ${i.symbol ?? null}, ${i.side ?? null}, ${i.decidedAtSec}, ${i.wakeId ? tx`${i.wakeId}::uuid` : null})
          RETURNING body`;
        const stored = inserted[0];
        if (!stored || !verifyRecord(stored.body, hash)) throw new RecordChainError(`record ${slot.seq} changed on its way through the database: it no longer hashes to ${hash}`);
        if (i.alongside) await i.alongside(tx as unknown as Db, slot.seq, hash);
        return { seq: slot.seq, hash };
      });
    },
    async listRecords(i: { deskId: string; limit: number; beforeSeq?: number }): Promise<RecordListRow[]> {
      await ready();
      const rows = await db<RawRecord[]>`SELECT ${listColumns()} FROM desk_records WHERE desk_id = ${i.deskId}::uuid AND (${i.beforeSeq ?? null}::bigint IS NULL OR seq < ${i.beforeSeq ?? null}) ORDER BY seq DESC LIMIT ${i.limit}`;
      return rows.map(toListRow);
    },
    async getRecord(i: { deskId: string; seq: number }): Promise<{ record: RecordRow; actions: ActionRow[]; grade: GradeRow | null } | null> {
      await ready();
      const rows = await db<RawRecord[]>`SELECT * FROM desk_records WHERE desk_id = ${i.deskId}::uuid AND seq = ${i.seq}`;
      const raw = rows[0];
      if (!raw) return null;
      const [actions, grades] = await Promise.all([
        db<RawAction[]>`SELECT * FROM desk_actions WHERE desk_id = ${i.deskId}::uuid AND record_seq = ${i.seq} ORDER BY sent_at_sec ASC`,
        db<{ record_seq: string; graded_at_sec: string; verdict: GradeRow["verdict"]; difference_bps: number | null; price_then_e8: string | null; price_later_e8: string | null; chosen: string; alternative: string; why: string; counts_for_timing: boolean }[]>`
          SELECT * FROM desk_grades WHERE desk_id = ${i.deskId}::uuid AND record_seq = ${i.seq}`,
      ]);
      const g = grades[0];
      return {
        record: toRecord(raw),
        actions: actions.map(toAction),
        grade: g ? { recordSeq: Number(g.record_seq), gradedAtSec: Number(g.graded_at_sec), verdict: g.verdict, differenceBps: g.difference_bps, priceThenE8: g.price_then_e8, priceLaterE8: g.price_later_e8, chosen: g.chosen, alternative: g.alternative, why: g.why, countsForTiming: g.counts_for_timing } : null,
      };
    },
    /** The records that ring the owner (plan §5.8) after `sinceSeq`, oldest first; a quiet check never appears. */
    async deskFeedSince(i: { deskId: string; sinceSeq: number; limit?: number }): Promise<RecordListRow[]> {
      await ready();
      const rows = await db<RawRecord[]>`SELECT ${listColumns()} FROM desk_records WHERE desk_id = ${i.deskId}::uuid AND seq > ${i.sinceSeq} AND outcome IN ${db(NOTIFIED)} ORDER BY seq ASC LIMIT ${i.limit ?? 50}`;
      return rows.map(toListRow);
    },
    async lastRecordSeq(deskId: string): Promise<number> {
      await ready();
      const rows = await db<{ seq: string | null }[]>`SELECT MAX(seq) AS seq FROM desk_records WHERE desk_id = ${deskId}::uuid`;
      return rows[0]?.seq ? Number(rows[0].seq) : 0;
    },
    /** The newest record about one name, for "recent" evidence and the repeat check. */
    async lastRecordOnSymbol(i: { deskId: string; symbol: string }): Promise<RecordListRow | null> {
      await ready();
      const rows = await db<RawRecord[]>`SELECT ${listColumns()} FROM desk_records WHERE desk_id = ${i.deskId}::uuid AND symbol = ${i.symbol} ORDER BY seq DESC LIMIT 1`;
      return rows[0] ? toListRow(rows[0]) : null;
    },
    async didSameTradeSince(i: { deskId: string; symbol: string; side: "buy" | "sell"; sinceSec: number }): Promise<boolean> {
      await ready();
      const rows = await db<{ n: string }[]>`SELECT count(*) AS n FROM desk_records WHERE desk_id = ${i.deskId}::uuid AND symbol = ${i.symbol} AND side = ${i.side} AND decided_at_sec >= ${i.sinceSec}
        AND outcome IN ('ACTED', 'ACTED_IN_PART', 'ACTED_BY_OVERRIDE', 'WOULD_HAVE_ACTED', 'ASKED')`;
      return Number(rows[0]?.n ?? 0) > 0;
    },
    async markSealed(i: { deskId: string; seq: number; signature: string; chainSeq: number }): Promise<void> {
      await ready();
      await db`UPDATE desk_records SET sealed_by_sig = ${storageKey(i.signature)}, sealed_seq = ${i.chainSeq} WHERE desk_id = ${i.deskId}::uuid AND seq = ${i.seq}`;
    },
    async insertAction(a: Omit<ActionRow, "id" | "confirmedAtSec" | "error" | "chainSeq" | "amountOut"> & { chainSeq?: number | null }, tx: Db = db): Promise<string> {
      await ready();
      const rows = await tx<{ id: string }[]>`INSERT INTO desk_actions (desk_id, record_seq, kind, state, signature, chain_seq, symbol, amount_in, expected_out, min_out, counted_e6, deadline_sec, sent_at_sec)
        VALUES (${a.deskId}::uuid, ${a.recordSeq}, ${a.kind}, ${a.state}, ${a.signature}, ${a.chainSeq ?? null}, ${a.symbol}, ${a.amountIn}, ${a.expectedOut}, ${a.minOut}, ${a.countedE6}, ${a.deadlineSec}, ${a.sentAtSec}) RETURNING id`;
      return rows[0]?.id ?? "";
    },
    async resolveAction(i: { id: string; state: ActionState; signature?: string | null; chainSeq?: number | null; amountOut?: string | null; error?: string | null; nowSec: number }): Promise<void> {
      await ready();
      await db`UPDATE desk_actions SET state = ${i.state}, signature = COALESCE(${i.signature ?? null}, signature), chain_seq = COALESCE(${i.chainSeq ?? null}, chain_seq),
        amount_out = COALESCE(${i.amountOut ?? null}, amount_out), error = ${i.error ?? null}, confirmed_at_sec = ${i.state === "confirmed" ? i.nowSec : null} WHERE id = ${i.id}::uuid`;
    },
    async unresolvedActions(deskId: string): Promise<ActionRow[]> {
      await ready();
      const rows = await db<RawAction[]>`SELECT * FROM desk_actions WHERE desk_id = ${deskId}::uuid AND state IN ('attempting', 'unknown') ORDER BY sent_at_sec ASC`;
      return rows.map(toAction);
    },
    async confirmedActionsSince(i: { deskId: string; sinceSec: number }): Promise<ActionRow[]> {
      await ready();
      const rows = await db<RawAction[]>`SELECT * FROM desk_actions WHERE desk_id = ${i.deskId}::uuid AND state = 'confirmed' AND kind IN ('buy', 'sell') AND confirmed_at_sec > ${i.sinceSec} ORDER BY confirmed_at_sec ASC`;
      return rows.map(toAction);
    },
    /** USDC E6 counted against the caps by confirmed buys and sells since `sinceSec` (the owner's rolling day). */
    async spentSince(i: { deskId: string; sinceSec: number }): Promise<string> {
      await ready();
      const rows = await db<{ total: string | null }[]>`SELECT SUM(counted_e6::numeric)::text AS total FROM desk_actions WHERE desk_id = ${i.deskId}::uuid AND state = 'confirmed' AND kind IN ('buy', 'sell') AND confirmed_at_sec > ${i.sinceSec}`;
      return rows[0]?.total ?? "0";
    },
    async standingDeferral(i: { deskId: string; symbol: string }): Promise<DeferralRow | null> {
      await ready();
      const rows = await db<{ id: string; symbol: string; kind: DeferralRow["kind"]; baseline: Record<string, unknown>; decision_seq: string; revisit_at_sec: string }[]>`
        SELECT id, symbol, kind, baseline, decision_seq, revisit_at_sec FROM desk_deferrals WHERE desk_id = ${i.deskId}::uuid AND symbol = ${i.symbol} AND ended_at_sec IS NULL ORDER BY id DESC LIMIT 1`;
      const r = rows[0];
      return r ? { id: Number(r.id), symbol: r.symbol, kind: r.kind, baseline: r.baseline, decisionSeq: Number(r.decision_seq), revisitAtSec: Number(r.revisit_at_sec) } : null;
    },
    async createDeferral(i: { deskId: string; symbol: string; kind: DeferralRow["kind"]; baseline: Record<string, unknown>; decisionSeq: number; revisitAtSec: number }, tx: Db = db): Promise<void> {
      await tx`INSERT INTO desk_deferrals (desk_id, symbol, kind, baseline, decision_seq, revisit_at_sec) VALUES (${i.deskId}::uuid, ${i.symbol}, ${i.kind}, ${tx.json(i.baseline as never)}, ${i.decisionSeq}, ${i.revisitAtSec})`;
    },
    async endDeferral(i: { id: number; because: string; nowSec: number }, tx: Db = db): Promise<void> {
      await tx`UPDATE desk_deferrals SET ended_at_sec = ${i.nowSec}, ended_because = ${i.because} WHERE id = ${i.id} AND ended_at_sec IS NULL`;
    },
  };
}
