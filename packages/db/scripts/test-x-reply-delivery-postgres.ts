/**
 * Real SQL integration checks, isolated from every configured application database.
 * Run from the repository root: pnpm exec tsx packages/db/scripts/test-x-reply-delivery-postgres.ts
 * Requires Docker and a locally cached postgres:17-alpine image. No actors, posts or trades run.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { getDb } from "../src/client";
import { ensureSchema } from "../src/migrate";
import { SCHEMA_SQL } from "../src/schema";
import { xReceiptByMention, xReceiptsByWallet, xReceiptUpsert, xRecordExecutionJournal, xRecoveryCandidates, xStoreRecoveredReceipt, xHasUnresolvedBroadcast, type XReceiptRecord } from "../src/x";
import { xGetRelayHealth, xSetStageHealth } from "../src/x-health";
import {
  xAcquireReplyDelivery, xBeginReplyPost, xClaimMention, xFinishReplyPost,
  xMarkInterruptedReplyPosts, xStopReplyDelivery, xIsRelayReply, xSuppressRelayReplyDeliveries,
} from "../src/x-reply-delivery";

const containerName = `masayume-x-delivery-test-${randomUUID().slice(0, 12)}`;
const password = randomUUID();
const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const HASH = `0x${"11".repeat(32)}`;
let containerId: string | undefined;
let db: ReturnType<typeof getDb> = null;
let passed = 0;

function receipt(id: string, status: XReceiptRecord["status"] = "refused"): XReceiptRecord {
  return {
    mentionId: id, authorId: "2001", handle: "test_fixture", wallet: null, grantId: null,
    marketId: null, side: null, stakeBase: null, status, reason: null,
    txHash: status === "filled" ? HASH : null, instruction: "INTEGRATION TEST ONLY", atMs: 1_800_000_000_000,
  };
}

async function main() {
  // --pull=never keeps this test local; the caller's DATABASE_URL is never read or used.
  containerId = docker("run", "--rm", "--pull=never", "--detach", "--name", containerName,
    "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17-alpine");
  const address = docker("port", containerId, "5432/tcp");
  assert.match(address, /^127\.0\.0\.1:\d+$/);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { docker("exec", containerId, "pg_isready", "--host=127.0.0.1", "--username=postgres"); ready = true; break; }
    catch { await pause(150); }
  }
  assert.ok(ready, "Disposable Postgres did not become ready");
  process.env.DATABASE_URL = `postgres://postgres:${password}@${address}/postgres`;
  db = getDb();
  assert.ok(db);
  const sql = db;

  async function check(name: string, run: () => Promise<void>, reset = true) {
    if (reset) await sql`TRUNCATE x_reply_delivery, x_receipts`;
    await run();
    passed++;
    console.log(`PASS ${name}`);
  }
  async function jobFor(id: string) {
    assert.equal(await xClaimMention(receipt(id), true), true);
    const job = await xAcquireReplyDelivery();
    assert.ok(job);
    assert.equal(job.mentionId, id);
    return job;
  }

  await check("legacy receipts survive an idempotent schema upgrade and are never implicitly queued", async () => {
    // Reproduce the deployed receipt shape before the additive details/outbox migration.
    await sql.unsafe(`CREATE TABLE x_receipts (
      mention_id TEXT PRIMARY KEY, author_id TEXT NOT NULL, handle TEXT, wallet TEXT,
      grant_id TEXT, market_id TEXT, side TEXT CHECK(side IN ('up','down')), stake_base TEXT,
      status TEXT NOT NULL CHECK(status IN ('refused','submitted','filled','nothing-filled','reverted','unknown')),
      reason TEXT, tx_hash TEXT, instruction TEXT NOT NULL, at_ms BIGINT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await sql`INSERT INTO x_receipts (mention_id, author_id, status, tx_hash, instruction, at_ms)
      VALUES ('1000', '2001', 'filled', ${HASH}, 'HISTORICAL TEST FIXTURE', 1800000000000)`;
    await Promise.all([ensureSchema(), ensureSchema(), ensureSchema()]);
    await sql.unsafe(SCHEMA_SQL);
    await sql.unsafe(SCHEMA_SQL);
    const legacy = await xReceiptByMention("1000");
    assert.equal(legacy?.status, "filled");
    assert.equal(legacy?.txHash, HASH);
    assert.equal(legacy?.bookedCostBase, undefined);
    assert.equal(await xClaimMention(receipt("1000"), true), false);
    assert.equal((await sql`SELECT mention_id FROM x_reply_delivery`).length, 0);
    assert.equal(await xAcquireReplyDelivery(), null);
  }, false);

  await check("32 concurrent claims create one receipt and one delivery job", async () => {
    const claims = await Promise.all(Array.from({ length: 32 }, () => xClaimMention(receipt("1001", "submitted"), true)));
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal((await sql`SELECT mention_id FROM x_receipts`).length, 1);
    assert.equal((await sql`SELECT mention_id FROM x_reply_delivery`).length, 1);
  });

  await check("outbox insertion failure rolls back the financial instruction claim", async () => {
    await sql.unsafe(`CREATE FUNCTION fail_test_delivery_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'deliberate disposable test failure'; END $$;
      CREATE TRIGGER fail_test_delivery_insert BEFORE INSERT ON x_reply_delivery
      FOR EACH ROW EXECUTE FUNCTION fail_test_delivery_insert()`);
    try {
      await assert.rejects(xClaimMention(receipt("1002"), true), /deliberate disposable test failure/);
      assert.equal((await sql`SELECT mention_id FROM x_receipts`).length, 0);
      assert.equal((await sql`SELECT mention_id FROM x_reply_delivery`).length, 0);
    } finally {
      await sql.unsafe("DROP TRIGGER fail_test_delivery_insert ON x_reply_delivery; DROP FUNCTION fail_test_delivery_insert()");
    }
    assert.equal(await xClaimMention(receipt("1002"), true), true);
  });

  await check("posting disabled records the claim without queuing a future public reply", async () => {
    assert.equal(await xClaimMention(receipt("1003"), false), true);
    assert.equal((await sql`SELECT mention_id FROM x_reply_delivery`).length, 0);
    assert.equal(await xClaimMention(receipt("1003"), true), false);
    assert.equal((await sql`SELECT mention_id FROM x_reply_delivery`).length, 0);
  });

  await check("submitted receipts are ineligible until a final receipt is persisted", async () => {
    assert.equal(await xClaimMention(receipt("1004", "submitted"), true), true);
    await sql`UPDATE x_reply_delivery SET updated_at = now() - interval '1 day'`;
    assert.equal(await xAcquireReplyDelivery(), null);
    await xReceiptUpsert({ ...receipt("1004", "filled"), bookedCostBase: "1234567", bookedContractsRaw: "2000000" });
    const job = await xAcquireReplyDelivery();
    assert.equal(job?.mentionId, "1004");
    const [stored] = await sql`SELECT jsonb_typeof(details) AS kind, details FROM x_receipts WHERE mention_id = '1004'`;
    assert.equal(stored?.kind, "object", `Receipt details must be a JSON object; got ${JSON.stringify(stored)}`);
    assert.equal((await xReceiptByMention("1004"))?.bookedCostBase, "1234567");
  });

  await check("receipt details round-trip as objects and partial updates preserve earlier facts", async () => {
    await xReceiptUpsert({ ...receipt("1005", "filled"), bookedCostBase: "1234567", bookedContractsRaw: "2000000", asset: "BTC", intervalSec: 300 });
    await xReceiptUpsert({ ...receipt("1005", "filled"), avgPriceBps: 6_172 });
    const saved = await xReceiptByMention("1005");
    assert.equal(saved?.bookedCostBase, "1234567");
    assert.equal(saved?.bookedContractsRaw, "2000000");
    assert.equal(saved?.asset, "BTC");
    assert.equal(saved?.intervalSec, 300);
    assert.equal(saved?.avgPriceBps, 6_172);
  });

  await check("corrupt historical details are ignored and non-object values can be replaced safely", async () => {
    assert.equal(await xClaimMention(receipt("1006", "filled"), false), true);
    for (const corrupt of [null, "not an object", [{ bookedCostBase: "999999999" }], { bookedCostBase: "not-money" }]) {
      await sql`UPDATE x_receipts SET details = ${sql.json(corrupt)}::jsonb WHERE mention_id = '1006'`;
      assert.equal((await xReceiptByMention("1006"))?.bookedCostBase, undefined);
      await xReceiptUpsert({ ...receipt("1006", "filled"), bookedCostBase: "1234567" });
      assert.equal((await xReceiptByMention("1006"))?.bookedCostBase, "1234567");
      const [stored] = await sql`SELECT jsonb_typeof(details) AS kind FROM x_receipts WHERE mention_id = '1006'`;
      assert.equal(stored?.kind, "object");
    }
  });

  await check("16 competing acquires give each available job to only one worker", async () => {
    for (const id of ["1010", "1011", "1012"]) assert.equal(await xClaimMention(receipt(id), true), true);
    const results = await Promise.all(Array.from({ length: 16 }, () => xAcquireReplyDelivery()));
    const jobs = results.filter((job) => job !== null);
    assert.equal(jobs.length, 3);
    assert.equal(new Set(jobs.map((job) => job.mentionId)).size, 3);
    assert.equal(new Set(jobs.map((job) => job.lease)).size, 3);
    const rows = await sql`SELECT attempts FROM x_reply_delivery`;
    assert.ok(rows.every((row) => row.attempts === 1));
    assert.equal(await xAcquireReplyDelivery(), null);
  });

  await check("only the current lease can persist a payload or acknowledge the reply", async () => {
    const job = await jobFor("1020");
    const stale = { ...job, lease: randomUUID() };
    assert.equal(await xBeginReplyPost(stale, "WRONG PAYLOAD", "901"), false);
    assert.equal(await xBeginReplyPost(job, "EXACT TEST PAYLOAD\nhttps://masayume.app", "902"), true);
    assert.equal(await xBeginReplyPost(job, "SECOND PAYLOAD", null), false);
    await assert.rejects(xFinishReplyPost(stale, "8001"), /acknowledgement was not stored/);
    await xStopReplyDelivery(stale, "failed", "stale-worker");
    const [posting] = await sql`SELECT state, reply_text, media_id FROM x_reply_delivery`;
    assert.deepEqual(posting, { state: "posting", reply_text: "EXACT TEST PAYLOAD\nhttps://masayume.app", media_id: "902" });
    await xFinishReplyPost(job, "8002");
    await xStopReplyDelivery(job, "unknown", "late-error");
    const [sent] = await sql`SELECT state, reply_id FROM x_reply_delivery`;
    assert.deepEqual(sent, { state: "sent", reply_id: "8002" });
    assert.equal(await xAcquireReplyDelivery(), null);
  });

  await check("stale preparation gets a new lease and its old worker cannot post or stop it", async () => {
    const original = await jobFor("1030");
    assert.equal(await xAcquireReplyDelivery(), null);
    await sql`UPDATE x_reply_delivery SET updated_at = now() - interval '6 minutes'`;
    const current = await xAcquireReplyDelivery();
    assert.ok(current);
    assert.equal(current.mentionId, original.mentionId);
    assert.notEqual(current.lease, original.lease);
    assert.equal(await xBeginReplyPost(original, "STALE", null), false);
    await xStopReplyDelivery(original, "failed", "stale-worker");
    const [row] = await sql`SELECT state, lease, attempts FROM x_reply_delivery`;
    assert.deepEqual(row, { state: "preparing", lease: current.lease, attempts: 2 });
    assert.equal(await xBeginReplyPost(current, "CURRENT", null), true);
  });

  await check("a stale POST becomes unknown while preserving its exact payload and cannot be reclaimed", async () => {
    const job = await jobFor("1040");
    assert.equal(await xBeginReplyPost(job, "MAY ALREADY BE PUBLIC", "903"), true);
    assert.equal(await xMarkInterruptedReplyPosts(), 0);
    await sql`UPDATE x_reply_delivery SET updated_at = now() - interval '6 minutes'`;
    assert.equal(await xAcquireReplyDelivery(), null);
    assert.equal(await xMarkInterruptedReplyPosts(), 1);
    assert.equal(await xMarkInterruptedReplyPosts(), 0);
    const [row] = await sql`SELECT state, reply_text, media_id, error_code FROM x_reply_delivery`;
    assert.deepEqual(row, { state: "unknown", reply_text: "MAY ALREADY BE PUBLIC", media_id: "903", error_code: "post-interrupted" });
    await sql`UPDATE x_reply_delivery SET updated_at = now() - interval '1 day'`;
    assert.equal(await xAcquireReplyDelivery(), null);
    assert.equal(await xBeginReplyPost(job, "DO NOT REPOST", null), false);
    await assert.rejects(xFinishReplyPost(job, "8003"), /acknowledgement was not stored/);
  });

  await check("unknown, failed, and sent terminal jobs never become eligible with age", async () => {
    const unknown = await jobFor("1050");
    await xStopReplyDelivery(unknown, "unknown", "test-uncertainty");
    const failed = await jobFor("1051");
    await xStopReplyDelivery(failed, "failed", "test-preparation-failure");
    const sent = await jobFor("1052");
    assert.equal(await xBeginReplyPost(sent, "SENT", null), true);
    await xFinishReplyPost(sent, "8004");
    await sql`UPDATE x_reply_delivery SET updated_at = now() - interval '1 day'`;
    assert.equal(await xAcquireReplyDelivery(), null);
    assert.equal(await xMarkInterruptedReplyPosts(), 0);
  });

  await check("durable journal retains sender, target, nonce and hash across uncertain final persistence", async () => {
    const actor = `0x${"22".repeat(20)}`;
    const owner = `0x${"33".repeat(20)}`;
    await xClaimMention({ ...receipt("1060", "submitted"), handle: "original" }, true);
    await xReceiptUpsert({ ...receipt("1060", "submitted"), handle: "renamed", wallet: owner, marketId: HASH, grantId: "7", side: "up",
      executionActor: actor, collateralDecimals: 6, recoveryFromBlock: "1234", expectedNonce: 9 });
    await xRecordExecutionJournal("1060", { journalState: "recorded", intentRecordedAtMs: 1800000000000 });
    assert.equal(await xHasUnresolvedBroadcast(actor), true);
    await xRecordExecutionJournal("1060", { journalState: "sent" }, HASH);
    assert.equal(await xHasUnresolvedBroadcast(actor), false);
    await xReceiptUpsert({ ...receipt("1060", "unknown"), wallet: owner, marketId: HASH, grantId: "7", side: "up" });
    const saved = await xReceiptByMention("1060");
    assert.equal(saved?.txHash, HASH);
    assert.equal(saved?.handle, "original");
    assert.equal(saved?.expectedNonce, 9);
    assert.equal(saved?.executionActor, actor);
    await assert.rejects(xRecordExecutionJournal("1060", { journalState: "sent" }, `0x${"55".repeat(32)}`), /not stored/);
  });

  await check("recovery restores known outcomes and a late worker cannot downgrade them", async () => {
    await xClaimMention(receipt("1061", "submitted"), true);
    await sql`UPDATE x_receipts SET updated_at = now() - interval '6 minutes'`;
    const [before] = await xRecoveryCandidates();
    assert.ok(before);
    const after = { ...before, status: "filled" as const, txHash: HASH, bookedCostBase: "1234567", bookedContractsRaw: "2469134" };
    assert.equal(await xStoreRecoveredReceipt(before, after), true);
    assert.equal(await xStoreRecoveredReceipt(before, { ...before, status: "unknown" }), false);
    await xReceiptUpsert({ ...before, status: "unknown" });
    const saved = await xReceiptByMention("1061");
    assert.equal(saved?.status, "filled");
    assert.equal(saved?.bookedCostBase, "1234567");
    assert.equal(saved?.txHash, HASH);
    assert.equal((await xAcquireReplyDelivery())?.mentionId, "1061");
  });

  await check("health separates provider checks, execution uncertainty and acknowledged images", async () => {
    await xSetStageHealth("polling", "ok");
    await xSetStageHealth("execution", "error");
    await xSetStageHealth("delivery", "disabled", true);
    await xClaimMention(receipt("1062", "unknown"), true);
    const job = await xAcquireReplyDelivery(); assert.ok(job);
    await xBeginReplyPost(job, "FIXTURE", "999");
    let health = await xGetRelayHealth();
    assert.equal(health?.polling?.state, "ok");
    assert.equal(health?.execution?.state, "error");
    assert.equal(health?.delivery?.state, "disabled");
    assert.equal(health?.unresolvedExecutions, 1);
    assert.equal(health?.lastImageReplyAtMs, null);
    await xFinishReplyPost(job, "888");
    health = await xGetRelayHealth();
    assert.ok(health?.lastImageReplyAtMs);
  });

  await check("stable bot identity suppresses own replies even when their POST acknowledgement was lost", async () => {
    const bot = "9000";
    await assert.rejects(xIsRelayReply({ id: "1", authorId: bot }, ""), /identity/);
    assert.equal(await xIsRelayReply({ id: "1", authorId: bot, replyTo: "500" }, bot), true);
    assert.equal(await xIsRelayReply({ id: "1", authorId: bot }, bot), false, "own top-level commands remain available");
    assert.equal(await xIsRelayReply({ id: "1", authorId: "2001", replyTo: "500" }, bot), false, "other users may reply with commands");
    const original = await jobFor("1070");
    assert.equal(await xBeginReplyPost(original, "ORIGINAL RECEIPT", "990"), true);
    await xFinishReplyPost(original, "8070");
    assert.equal(await xIsRelayReply({ id: "8070", authorId: bot }, bot), true, "persisted IDs work without reply-parent metadata");
    assert.equal((await sql`SELECT mention_id FROM x_receipts`).length, 1, "reply classification creates no receipt or outbox");
  });

  await check("known relay receipts cannot acquire or cross the POST gate, and old recursive jobs are permanently fenced", async () => {
    const original = await jobFor("1080");
    await xBeginReplyPost(original, "VALID RECEIPT", "991");
    // Reproduce the old poller racing acknowledgement storage: it already claimed this bot reply.
    const recursive = await jobFor("8080");
    await xFinishReplyPost(original, "8080");
    assert.equal(await xBeginReplyPost(recursive, "MUST NOT POST", null), false);
    await sql`UPDATE x_reply_delivery SET updated_at = now() - interval '6 minutes' WHERE mention_id = '8080'`;
    assert.equal(await xAcquireReplyDelivery(), null);
    assert.equal(await xSuppressRelayReplyDeliveries(), 1);
    assert.equal(await xSuppressRelayReplyDeliveries(), 0);
    const [held] = await sql`SELECT state, lease, error_code FROM x_reply_delivery WHERE mention_id = '8080'`;
    assert.deepEqual(held, { state: "failed", lease: null, error_code: "relay-reply-suppressed" });
    const [sent] = await sql`SELECT state, reply_id, media_id, reply_text FROM x_reply_delivery WHERE mention_id = '1080'`;
    assert.deepEqual(sent, { state: "sent", reply_id: "8080", media_id: "991", reply_text: "VALID RECEIPT" });
    assert.equal(await xBeginReplyPost(recursive, "STALE WORKER", null), false);
    assert.equal(await xAcquireReplyDelivery(), null);
  });

  await check("pending and ambiguous recursive jobs are held without erasing sent clutter or the valid original receipt", async () => {
    const original = await jobFor("1090");
    await xBeginReplyPost(original, "VALID ORIGINAL", "992");
    const firstClutter = await jobFor("8090");
    await xBeginReplyPost(firstClutter, "SPURIOUS REFUSAL", "993");
    await xFinishReplyPost(original, "8090");
    const uncertainClutter = await jobFor("8091");
    await xBeginReplyPost(uncertainClutter, "UNKNOWN PUBLIC RESULT", "994");
    await xStopReplyDelivery(uncertainClutter, "unknown", "post-not-acknowledged");
    await xFinishReplyPost(firstClutter, "8091");
    // Another historical job can be identified directly from authenticated author + reply parent.
    await xClaimMention(receipt("8092"), true);
    assert.equal(await xSuppressRelayReplyDeliveries(), 1);
    assert.equal(await xSuppressRelayReplyDeliveries("8092"), 1);
    const rows = await sql`SELECT mention_id, state, reply_id, media_id, reply_text FROM x_reply_delivery ORDER BY mention_id`;
    assert.equal(rows[0]?.state, "sent");
    assert.equal(rows[1]?.state, "sent");
    assert.deepEqual(rows[2], { mention_id: "8091", state: "failed", reply_id: null, media_id: "994", reply_text: "UNKNOWN PUBLIC RESULT" });
    assert.equal(rows[3]?.state, "failed");
    assert.equal(await xAcquireReplyDelivery(), null);
  });

  await check("wallet orders exclude known bot receipts before applying the limit while keeping their audit rows", async () => {
    const wallet = `0x${"44".repeat(20)}`;
    await xClaimMention({ ...receipt("1100", "filled"), wallet, atMs: 1_800_000_000_000 }, true);
    await xClaimMention({ ...receipt("1101"), wallet, atMs: 1_800_000_000_001 }, true);
    await xClaimMention({ ...receipt("1102", "unknown"), wallet, atMs: 1_800_000_000_002 }, true);
    await xClaimMention({ ...receipt("1103"), wallet, atMs: 1_800_000_000_003 }, true);
    await xClaimMention({ ...receipt("1104"), wallet: `0x${"55".repeat(20)}`, atMs: 1_800_000_000_004 }, true);
    // Reproduce the acknowledged old recursion, without asking the guarded delivery API to send it.
    await sql`UPDATE x_reply_delivery SET state = 'sent', reply_id = '1102' WHERE mention_id = '1100'`;
    await sql`UPDATE x_reply_delivery SET state = 'sent', reply_id = '1103' WHERE mention_id = '1102'`;
    await xSuppressRelayReplyDeliveries();
    assert.deepEqual((await xReceiptsByWallet(wallet, 30))?.map(r => r.mentionId), ["1101", "1100"]);
    assert.deepEqual((await xReceiptsByWallet(wallet, 1))?.map(r => r.mentionId), ["1101"]);
    assert.equal((await xReceiptByMention("1102"))?.status, "unknown");
    assert.equal((await xReceiptByMention("1103"))?.status, "refused");
    assert.equal((await sql`SELECT mention_id FROM x_receipts`).length, 5);
    const health = await xGetRelayHealth();
    assert.equal(health?.unresolvedExecutions, 0, "a known bot output is not an unresolved wallet order");
    assert.equal(health?.deliveryNeedsInspection, 0, "a permanently suppressed recursive job is resolved");
  });

  await check("suppressed delivery is resolved while real failures, ambiguous posts and stale posts remain actionable", async () => {
    await jobFor("1110");
    await xSuppressRelayReplyDeliveries("1110");
    assert.equal((await xGetRelayHealth())?.deliveryNeedsInspection, 0);
    const failure = await jobFor("1111");
    await xStopReplyDelivery(failure, "failed", "preparation-failed");
    await sql`UPDATE x_reply_delivery SET error_code = NULL WHERE mention_id = '1111'`;
    const unknown = await jobFor("1112");
    await xBeginReplyPost(unknown, "UNCERTAIN", null);
    await xStopReplyDelivery(unknown, "unknown", "post-not-acknowledged");
    const stale = await jobFor("1113");
    await xBeginReplyPost(stale, "STILL POSTING", null);
    await sql`UPDATE x_reply_delivery SET updated_at = now() - interval '6 minutes' WHERE mention_id = '1113'`;
    await xClaimMention(receipt("1114", "unknown"), false);
    const health = await xGetRelayHealth();
    assert.equal(health?.deliveryNeedsInspection, 3);
    assert.equal(health?.unresolvedExecutions, 1);
  });

  console.log(`All ${passed} X delivery SQL integration checks passed on disposable Postgres 17.`);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  try { await db?.end({ timeout: 5 }); }
  finally {
    if (containerId) docker("rm", "--force", containerId);
  }
}
