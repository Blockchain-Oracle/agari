/** Real database checks using a disposable loopback Postgres. Never sends a chain transaction. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import type { FaucetClaim } from "../../core/src/faucet/index";
import type { FaucetChain } from "../../markets/src/faucet/index";
import { createFaucetService } from "../../../web/src/features/funding/faucet-service.server";
import { getDb } from "../src/client";
import { ensureSchema } from "../src/migrate";
import { SCHEMA_SQL } from "../src/schema";
import { readFaucetStore } from "../src/faucet";

const name = `masayume-faucet-test-${randomUUID().slice(0, 10)}`;
const password = randomUUID();
const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const FUNDER = `0x${"aa".repeat(20)}`;
const wallet = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const ETH = 1_000_000_000_000_000_000n;
let container: string | undefined;
let db: ReturnType<typeof getDb> = null;
let passed = 0;
async function main() {
  container = docker("run", "--rm", "--pull=never", "--detach", "--name", name, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17-alpine");
  const endpoint = docker("port", container, "5432/tcp");
  assert.match(endpoint, /^127\.0\.0\.1:\d+$/);
  for (let n = 0; n < 100; n++) {
    try { docker("exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"); break; } catch { await pause(100); }
  }
  process.env.DATABASE_URL = `postgres://postgres:${password}@${endpoint}/postgres`;
  db = getDb(); assert.ok(db); const sql = db;
  await Promise.all([ensureSchema(), ensureSchema()]);
  await sql.unsafe(SCHEMA_SQL);
  const balances = new Map<string, bigint>();
  const landed = new Set<string>();
  let nonce = 0; let sends = 0; let interrupt = false;
  const chain: FaucetChain = {
    address: FUNDER,
    balance: async (w) => w === FUNDER ? 100n * ETH : balances.get(w) ?? 0n,
    verify: async () => true,
    prepare: async () => { const n = nonce++; return { nonce: n, feeWei: "1000", txHash: `0x${String(n).padStart(64, "0")}` as `0x${string}`, rawTransaction: `0x${n.toString(16).padStart(2, "0")}` as `0x${string}` }; },
    inspect: async (c) => landed.has(c.txHash) ? "confirmed" : "prepared",
    broadcast: async (c) => {
      // A separate connection must see the row before the chain can see the bytes.
      assert.equal((await (await readFaucetStore()).claim(c.id))?.txHash, c.txHash);
      if (interrupt) throw new Error("interrupted before broadcast");
      if (!landed.has(c.txHash)) { sends++; landed.add(c.txHash); balances.set(c.wallet, (balances.get(c.wallet) ?? 0n) + BigInt(c.amountWei)); }
    },
  };
  let service = createFaucetService(chain);
  const request = async (n: number, ip = `ip-${n}`) => { const c = await service.challenge(wallet(n), ip, "https://masayume.app"); return service.claim(c.id, "0xab", ip); };
  async function check(label: string, run: () => Promise<void>) {
    await sql`TRUNCATE faucet_claims, faucet_challenges`;
    balances.clear(); landed.clear(); nonce = 0; sends = 0; interrupt = false;
    await run(); passed++; console.log(`PASS ${label}`);
  }
  await check("32 requests across service instances reserve and pay exactly once", async () => {
    const c = await service.challenge(wallet(1), "ip-1", "https://masayume.app");
    const all = await Promise.all(Array.from({ length: 32 }, () => createFaucetService(chain).claim(c.id, "0xab", "ip-1")));
    assert.equal(new Set(all.map((r) => r.txHash)).size, 1); assert.equal(sends, 1);
    assert.equal(Number((await sql`SELECT count(*) AS count FROM faucet_claims`)[0]!.count), 1);
  });
  await check("competing challenges cannot bypass one-wallet cooldown", async () => {
    const challenges = await Promise.all([service.challenge(wallet(2), "ip-2", "https://masayume.app"), service.challenge(wallet(2), "ip-2", "https://masayume.app")]);
    const results = await Promise.allSettled(challenges.map((c) => service.claim(c.id, "0xab", "ip-2")));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1); assert.equal(sends, 1);
  });
  await check("rolling 40 STT allocation cannot be exceeded by another wallet", async () => {
    for (let n = 1; n <= 20; n++) await request(n);
    await assert.rejects(request(21), (e: unknown) => (e as { code: string }).code === "daily-limit");
    const used = await (await readFaucetStore()).used(Date.now() - 86_400_000, "");
    assert.equal(used.amountWei, 40n * ETH); assert.equal(sends, 20);
  });
  await check("a failed insert rolls back and never broadcasts", async () => {
    await sql.unsafe(`CREATE FUNCTION fail_faucet_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'deliberate fixture failure'; END $$; CREATE TRIGGER fail_faucet_insert BEFORE INSERT ON faucet_claims FOR EACH ROW EXECUTE FUNCTION fail_faucet_insert();`);
    try { await assert.rejects(request(1)); assert.equal(sends, 0); assert.equal((await sql`SELECT id FROM faucet_claims`).length, 0); }
    finally { await sql.unsafe("DROP TRIGGER fail_faucet_insert ON faucet_claims; DROP FUNCTION fail_faucet_insert();"); }
  });
  await check("restart resumes committed bytes and does not allocate twice", async () => {
    interrupt = true;
    const first = await request(1); assert.equal(first.status, "prepared");
    const before = await (await readFaucetStore()).claim(first.id); assert.ok(before?.rawTransaction);
    interrupt = false; service = createFaucetService(chain);
    const after = await service.claim(first.id, "0xab", "new-ip");
    assert.equal(after.txHash, first.txHash); assert.equal(after.status, "confirmed"); assert.equal(sends, 1);
    assert.equal((await (await readFaucetStore()).claim(first.id))?.rawTransaction, before.rawTransaction);
    await sql.unsafe(SCHEMA_SQL); assert.equal((await sql`SELECT id FROM faucet_claims`).length, 1);
  });
  console.log(`${passed} real Postgres checks passed. No chain transactions sent.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Integration check failed"); process.exitCode = 1; }).finally(async () => {
  if (db) await db.end({ timeout: 1 });
  if (container) docker("rm", "--force", container);
});
