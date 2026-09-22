/**
 * The owner's answers (desk.md, plan §5.8): approval requests the desk raised (ask first, or a large action) and
 * their signed answers, and the signed "check now" request with its ten-minute throttle. The web verifies every
 * signature before a row is written here; the runner reads answered rows and carries them out, re-quoted and
 * re-gated, without a second model call.
 */
import type { Db } from "./client";
import { storageKey } from "./keys";
import { ensureSchema } from "./migrate";

export type ApprovalAnswer = "approved" | "declined" | "expired";

export type ApprovalStatus = "open" | "approved" | "declined" | "expired" | "cancelled";

export interface ApprovalRow {
  id: string;
  deskId: string;
  recordSeq: number;
  /** The same record, under the names C5 reads: `decisionSeq`/`recordSeq`, `reason`/`askedBecause`, `executionSeq`/`executedSeq`. */
  decisionSeq: number;
  /** The fingerprint of the record that asked: the owner's signed answer names it. */
  decisionHash: string;
  reason: "ask_first" | "large_action";
  status: ApprovalStatus;
  executionSeq: number | null;
  /** From the record's timing answer and cost evidence, for the request card. */
  confidencePercent: number | null;
  costBps: number | null;
  turnedDown: { option: string; reason: string }[];
  symbol: string;
  side: "buy" | "sell";
  askedBecause: "ask_first" | "large_action";
  amountIn: string;
  expectedOut: string;
  summary: string;
  askedAtSec: number;
  expiresAtSec: number;
  answer: ApprovalAnswer | null;
  answeredAtSec: number | null;
  signer: string | null;
  signature: string | null;
  executedSeq: number | null;
}

/** One check-now per desk per this long (plan §5.8). */
export const CHECK_NOW_THROTTLE_SEC = 600;

interface RawApproval {
  id: string;
  desk_id: string;
  record_seq: string;
  record_hash: string | null;
  body: Record<string, unknown> | null;
  symbol: string;
  side: "buy" | "sell";
  asked_because: "ask_first" | "large_action";
  amount_in: string;
  expected_out: string;
  summary: string;
  asked_at_sec: string;
  expires_at_sec: string;
  answer: ApprovalAnswer | null;
  answered_at_sec: string | null;
  signer: string | null;
  signature: string | null;
  executed_seq: string | null;
}

const num = (v: string | null): number | null => (v === null ? null : Number(v));
const statusOf = (r: RawApproval, nowSec: number): ApprovalStatus => r.answer ?? (Number(r.expires_at_sec) <= nowSec ? "expired" : "open");
const toApproval = (r: RawApproval, nowSec: number): ApprovalRow => {
  const timing = (r.body?.timing ?? null) as { decision?: { confidencePercent?: number; rejected?: { option: string; reason: string }[] } | null } | null;
  const evidence = (r.body?.evidence ?? []) as { kind?: string; costBps?: number | null }[];
  return {
  id: r.id,
  deskId: r.desk_id,
  recordSeq: Number(r.record_seq),
  decisionSeq: Number(r.record_seq),
  decisionHash: r.record_hash ?? "",
  reason: r.asked_because,
  status: statusOf(r, nowSec),
  executionSeq: num(r.executed_seq),
  confidencePercent: timing?.decision?.confidencePercent ?? null,
  costBps: evidence.find((e) => e.kind === "cost")?.costBps ?? null,
  turnedDown: timing?.decision?.rejected ?? [],
  symbol: r.symbol,
  side: r.side,
  askedBecause: r.asked_because,
  amountIn: r.amount_in,
  expectedOut: r.expected_out,
  summary: r.summary,
  askedAtSec: Number(r.asked_at_sec),
  expiresAtSec: Number(r.expires_at_sec),
  answer: r.answer,
  answeredAtSec: num(r.answered_at_sec),
  signer: r.signer,
  signature: r.signature,
  executedSeq: num(r.executed_seq),
  };
};
/** An approval with the record that asked: its fingerprint and the timing answer the card shows. */
const WITH_RECORD = "a.*, r.record_hash, r.body";

export function deskApprovalQueries(db: Db) {
  const ready = () => ensureSchema();
  return {
    /** `open` lists only the unanswered, unexpired requests; otherwise the newest 50, answered or not. */
    async listApprovals(i: { deskId: string; open?: boolean; nowSec?: number }): Promise<ApprovalRow[]> {
      await ready();
      const nowSec = i.nowSec ?? Math.floor(Date.now() / 1000);
      const rows = i.open
        ? await db<RawApproval[]>`SELECT ${db.unsafe(WITH_RECORD)} FROM desk_approvals a LEFT JOIN desk_records r ON r.desk_id = a.desk_id AND r.seq = a.record_seq WHERE a.desk_id = ${i.deskId}::uuid AND a.answer IS NULL AND a.expires_at_sec > ${nowSec} ORDER BY a.asked_at_sec DESC`
        : await db<RawApproval[]>`SELECT ${db.unsafe(WITH_RECORD)} FROM desk_approvals a LEFT JOIN desk_records r ON r.desk_id = a.desk_id AND r.seq = a.record_seq WHERE a.desk_id = ${i.deskId}::uuid ORDER BY a.asked_at_sec DESC LIMIT 50`;
      return rows.map((r) => toApproval(r, nowSec));
    },
    /** Written by the runner beside the record that asked (same transaction). */
    async createApproval(i: { deskId: string; recordSeq: number; symbol: string; side: "buy" | "sell"; askedBecause: "ask_first" | "large_action"; amountIn: string; expectedOut: string; summary: string; askedAtSec: number; expiresAtSec: number }, tx: Db = db): Promise<void> {
      await tx`INSERT INTO desk_approvals (desk_id, record_seq, symbol, side, asked_because, amount_in, expected_out, summary, asked_at_sec, expires_at_sec)
        VALUES (${i.deskId}::uuid, ${i.recordSeq}, ${i.symbol}, ${i.side}, ${i.askedBecause}, ${i.amountIn}, ${i.expectedOut}, ${i.summary}, ${i.askedAtSec}, ${i.expiresAtSec})`;
    },
    /** The owner's signed answer. Refused when the request is already answered or has lapsed. */
    async answerApproval(i: { deskId: string; approvalId: string; answer: "approved" | "declined"; signer: string; signature: string; nowSec: number }): Promise<{ ok: true } | { ok: false; reason: "not_found" | "already_answered" | "expired" }> {
      await ready();
      const rows = await db<RawApproval[]>`SELECT ${db.unsafe(WITH_RECORD)} FROM desk_approvals a LEFT JOIN desk_records r ON r.desk_id = a.desk_id AND r.seq = a.record_seq WHERE a.id = ${i.approvalId}::uuid AND a.desk_id = ${i.deskId}::uuid`;
      const row = rows[0];
      if (!row) return { ok: false, reason: "not_found" };
      if (row.answer !== null) return { ok: false, reason: "already_answered" };
      if (Number(row.expires_at_sec) <= i.nowSec) return { ok: false, reason: "expired" };
      const updated = await db`UPDATE desk_approvals SET answer = ${i.answer}, answered_at_sec = ${i.nowSec}, signer = ${storageKey(i.signer)}, signature = ${i.signature}
        WHERE id = ${i.approvalId}::uuid AND answer IS NULL`;
      if (updated.count !== 1) return { ok: false, reason: "already_answered" };
      await db`INSERT INTO desk_events (desk_id, kind, actor, detail, at_sec) VALUES (${i.deskId}::uuid, 'approval_answered', 'owner', ${db.json({ approvalId: i.approvalId, recordSeq: Number(row.record_seq), answer: i.answer })}, ${i.nowSec})`;
      return { ok: true };
    },
    /** Approved and not yet carried out, oldest first. */
    async approvedRequests(deskId: string): Promise<ApprovalRow[]> {
      await ready();
      const rows = await db<RawApproval[]>`SELECT ${db.unsafe(WITH_RECORD)} FROM desk_approvals a LEFT JOIN desk_records r ON r.desk_id = a.desk_id AND r.seq = a.record_seq WHERE a.desk_id = ${deskId}::uuid AND a.answer = 'approved' AND a.executed_seq IS NULL ORDER BY a.answered_at_sec ASC`;
      return rows.map((r) => toApproval(r, Math.floor(Date.now() / 1000)));
    },
    async markApprovalExecuted(i: { approvalId: string; executedSeq: number }, tx: Db = db): Promise<void> {
      await tx`UPDATE desk_approvals SET executed_seq = ${i.executedSeq} WHERE id = ${i.approvalId}::uuid`;
    },
    /** Requests nobody answered in time: marked expired, returned so the runner can say so. */
    async expireApprovals(i: { deskId: string; nowSec: number }): Promise<ApprovalRow[]> {
      await ready();
      const rows = await db<RawApproval[]>`UPDATE desk_approvals SET answer = 'expired', answered_at_sec = ${i.nowSec} WHERE desk_id = ${i.deskId}::uuid AND answer IS NULL AND expires_at_sec <= ${i.nowSec} RETURNING *, NULL::text AS record_hash, NULL::jsonb AS body`;
      return rows.map((r) => toApproval(r, i.nowSec));
    },
    /** When the owner was last asked about this name and has not answered; null when nothing is pending. */
    async pendingApprovalSince(i: { deskId: string; symbol: string; nowSec: number }): Promise<number | null> {
      await ready();
      const rows = await db<{ asked_at_sec: string }[]>`SELECT asked_at_sec FROM desk_approvals WHERE desk_id = ${i.deskId}::uuid AND symbol = ${i.symbol} AND answer IS NULL AND expires_at_sec > ${i.nowSec} ORDER BY asked_at_sec DESC LIMIT 1`;
      return rows[0] ? Number(rows[0].asked_at_sec) : null;
    },
    /**
     * A signed "check now": one `check_now` wake row, which the runner picks up on its next tick. Throttled to one
     * every ten minutes per desk, counted from the last request whether or not it has run yet. The studio's first
     * read after a mandate is the same request with `trigger: "test_read"` (throttled on its own, so it never
     * blocks a Check now).
     */
    async requestCheckNow(i: { deskId: string; signer: string; signature: string; nowSec: number; trigger?: "check_now" | "test_read" }): Promise<{ ok: true } | { ok: false; throttledUntilSec: number }> {
      await ready();
      const trigger = i.trigger ?? "check_now";
      return db.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext(${i.deskId}))`;
        const [last] = await tx<{ scheduled_for_sec: string }[]>`SELECT scheduled_for_sec FROM desk_wakes WHERE desk_id = ${i.deskId}::uuid AND trigger = ${trigger} ORDER BY scheduled_for_sec DESC LIMIT 1`;
        const lastSec = last ? Number(last.scheduled_for_sec) : null;
        if (lastSec !== null && lastSec + CHECK_NOW_THROTTLE_SEC > i.nowSec) return { ok: false as const, throttledUntilSec: lastSec + CHECK_NOW_THROTTLE_SEC };
        await tx`INSERT INTO desk_wakes (desk_id, scheduled_for_sec, trigger, status, requested_by, signature) VALUES (${i.deskId}::uuid, ${i.nowSec}, ${trigger}, 'requested', ${storageKey(i.signer)}, ${i.signature})`;
        await tx`INSERT INTO desk_events (desk_id, kind, actor, detail, at_sec) VALUES (${i.deskId}::uuid, ${trigger}, 'owner', ${tx.json({})}, ${i.nowSec})`;
        return { ok: true as const };
      });
    },
  };
}
