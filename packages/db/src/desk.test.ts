/**
 * The record chain and the check-now throttle against a real Postgres (`DATABASE_URL`); skipped without one. Money
 * correctness lives in core's tests; what is in doubt here is the database's part: gap-free `seq`, `prev_hash`
 * links, a body that names the wrong slot refused, the feed's quiet-check filter, and one check-now per ten minutes.
 */
import { hashRecord, ZERO_HASH } from "@agari/core/desk";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sslFor } from "./client";
import { CHECK_NOW_THROTTLE_SEC } from "./desk-approvals";
import { deskQueries, type DeskQueries } from "./desk-queries";
import { RecordChainError } from "./desk-records";

const url = process.env.DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("desk records and check-now (real Postgres)", () => {
  const db = postgres(url ?? "postgres://unused", { max: 2, ssl: url ? sslFor(url) : false, onnotice: () => undefined });
  const q: DeskQueries = deskQueries(db);
  const owner = `test${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let deskId = "";
  const nowSec = 1_800_000_000;

  beforeAll(async () => {
    const desk = await q.createPracticeDesk({ owner, cluster: "localnet", mandateBody: { preset: "ailabs" }, fingerprint: `0x${"ab".repeat(32)}`, signer: owner, signature: "sig", nowSec });
    deskId = desk.id;
  });

  afterAll(async () => {
    if (deskId) {
      for (const table of ["desk_events", "desk_wakes", "desk_approvals", "desk_owner_requests", "desk_records", "desk_paper", "desk_mandates"]) await db.unsafe(`DELETE FROM ${table} WHERE desk_id = '${deskId}'`);
      await db`DELETE FROM desks WHERE id = ${deskId}::uuid`;
    }
    await db.end();
  });

  const body = (seq: number, prevHash: string, outcome: string) => ({ schemaVersion: "desk.v1", seq, prevHash, outcome, desk: owner, chainId: 104 });

  it("links records by prev_hash with gap-free seq, and refuses a body that names the wrong slot", async () => {
    const first = await q.appendRecord({ deskId, body: (slot) => body(slot.seq, slot.prevHash, "NOTHING_TO_DO"), privateNotes: null, outcome: "NOTHING_TO_DO", summary: "quiet", mode: "practice", wakeId: null, decidedAtSec: nowSec });
    expect(first.seq).toBe(1);
    expect(first.hash).toBe(hashRecord(body(1, ZERO_HASH, "NOTHING_TO_DO")));

    const second = await q.appendRecord({ deskId, body: body(2, first.hash, "WOULD_HAVE_ACTED"), privateNotes: { note: "private" }, outcome: "WOULD_HAVE_ACTED", summary: "I would have bought", mode: "practice", symbol: "OPENAI", side: "buy", wakeId: null, decidedAtSec: nowSec + 3600 });
    expect(second.seq).toBe(2);

    await expect(q.appendRecord({ deskId, body: body(3, ZERO_HASH, "WAITED"), privateNotes: null, outcome: "WAITED", summary: "x", mode: "practice", wakeId: null, decidedAtSec: nowSec })).rejects.toBeInstanceOf(RecordChainError);
    await expect(q.appendRecord({ deskId, body: body(9, second.hash, "WAITED"), privateNotes: null, outcome: "WAITED", summary: "x", mode: "practice", wakeId: null, decidedAtSec: nowSec })).rejects.toBeInstanceOf(RecordChainError);

    const listed = await q.listRecords({ deskId, limit: 10 });
    expect(listed.map((r) => [r.seq, r.prevHash])).toEqual([[2, first.hash], [1, ZERO_HASH]]);
    const stored = await q.getRecord({ deskId, seq: 2 });
    expect(stored?.record.body).toEqual(body(2, first.hash, "WOULD_HAVE_ACTED"));
    expect(stored?.record.recordHash).toBe(second.hash);
    // The feed rings only for what matters: the quiet check stays out.
    expect((await q.deskFeedSince({ deskId, sinceSeq: 0 })).map((r) => r.seq)).toEqual([2]);
    expect(await q.lastRecordOnSymbol({ deskId, symbol: "OPENAI" })).toMatchObject({ seq: 2, side: "buy" });
  });

  it("lists an approval with the fingerprint of the record that asked, answers it once, and keeps an owner request until the runner finishes it", async () => {
    await q.createApproval({ deskId, recordSeq: 2, symbol: "OPENAI", side: "buy", askedBecause: "ask_first", amountIn: "50000000", expectedOut: "1000000000", summary: "buy $50 of OpenAI", askedAtSec: nowSec, expiresAtSec: nowSec + 6 * 3600 });
    const [open] = await q.listApprovals({ deskId, open: true, nowSec: nowSec + 1 });
    expect(open).toMatchObject({ decisionSeq: 2, reason: "ask_first", status: "open", executionSeq: null, turnedDown: [] });
    expect(open?.decisionHash).toBe((await q.getRecord({ deskId, seq: 2 }))?.record.recordHash);
    expect(await q.answerApproval({ deskId, approvalId: open!.id, answer: "approved", signer: owner, signature: "a1", nowSec: nowSec + 2 })).toEqual({ ok: true });
    expect(await q.answerApproval({ deskId, approvalId: open!.id, answer: "declined", signer: owner, signature: "a2", nowSec: nowSec + 3 })).toEqual({ ok: false, reason: "already_answered" });
    expect((await q.approvedRequests(deskId)).map((a) => a.recordSeq)).toEqual([2]);
    expect((await q.listApprovals({ deskId, nowSec: nowSec + 4 }))[0]?.status).toBe("approved");

    const requested = await q.requestOwnerAction({ deskId, kind: "sell_all", signer: owner, signature: "o1", nowSec: nowSec + 5 });
    expect(requested.ok).toBe(true);
    expect(await q.requestOwnerAction({ deskId, kind: "close", signer: owner, signature: "o2", nowSec: nowSec + 6 })).toEqual({ ok: false, reason: "pending" });
    expect(await q.pendingOwnerRequest(deskId)).toMatchObject({ kind: "sell_all", signer: owner });
    expect(await q.takeRequestedWake({ deskId, nowSec: nowSec + 7 })).toMatchObject({ trigger: "owner_request" });
    if (requested.ok) await q.finishOwnerRequest({ requestId: requested.requestId, note: "done", nowSec: nowSec + 8 });
    expect(await q.pendingOwnerRequest(deskId)).toBeNull();
  });

  it("throttles check-now to one per ten minutes and hands the runner one requested wake", async () => {
    expect(await q.requestCheckNow({ deskId, signer: owner, signature: "s1", nowSec })).toEqual({ ok: true });
    expect(await q.requestCheckNow({ deskId, signer: owner, signature: "s2", nowSec: nowSec + 60 })).toEqual({ ok: false, throttledUntilSec: nowSec + CHECK_NOW_THROTTLE_SEC });
    const wake = await q.takeRequestedWake({ deskId, nowSec: nowSec + 61 });
    expect(wake).toMatchObject({ trigger: "check_now", status: "running", requestedBy: owner });
    expect(await q.takeRequestedWake({ deskId, nowSec: nowSec + 62 })).toBeNull();
    expect(await q.requestCheckNow({ deskId, signer: owner, signature: "s3", nowSec: nowSec + CHECK_NOW_THROTTLE_SEC })).toEqual({ ok: true });
    // The hourly claim is the row: a second claim of the same slot finds it taken.
    expect(await q.claimWake({ deskId, scheduledForSec: nowSec, trigger: "hour", nowSec })).not.toBeNull();
    expect(await q.claimWake({ deskId, scheduledForSec: nowSec, trigger: "hour", nowSec })).toBeNull();
  });
});
