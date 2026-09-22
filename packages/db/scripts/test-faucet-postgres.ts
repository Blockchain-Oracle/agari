/** Real database checks using a disposable loopback Postgres (Docker, or `FAUCET_TEST_DATABASE_URL`). Never sends a chain transaction. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { SOL_FAUCET_POLICY as POLICY, TUSDC_FAUCET_POLICY as TUSDC, type AnyFaucetClaim } from "../../core/src/faucet/index";
import { encodeBase58 } from "../../core/src/types/base58";
import type { FaucetChain } from "../../markets/src/faucet/index";
import { createFaucetService } from "../../../web/src/features/funding/faucet-service.server";
import { getDb } from "../src/client";
import { ensureSchema } from "../src/migrate";
import { SCHEMA_SQL } from "../src/schema";
import { readFaucetStore } from "../src/faucet";

const name = `agari-faucet-test-${randomUUID().slice(0, 10)}`;
const password = randomUUID();
const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const key = (n: number, length = 32) => encodeBase58(new Uint8Array(length).fill(n));
const FUNDER = key(0xaa);
const wallet = (n: number) => key(n);
const SIG = key(0xab, 64);
const SOL = 1_000_000_000n;
let container: string | undefined;
let db: ReturnType<typeof getDb> = null;
let passed = 0;
async function main() {
  const local = process.env.FAUCET_TEST_DATABASE_URL;
  if (local) {
    // A disposable loopback database instead of Docker (its faucet tables are truncated): never a shared or remote one.
    assert.match(new URL(local).hostname, /^(localhost|127\.0\.0\.1)$/);
    process.env.DATABASE_URL = local;
  } else {
    container = docker("run", "--rm", "--pull=never", "--detach", "--name", name, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17-alpine");
    const endpoint = docker("port", container, "5432/tcp");
    assert.match(endpoint, /^127\.0\.0\.1:\d+$/);
    for (let n = 0; n < 100; n++) {
      try { docker("exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"); break; } catch { await pause(100); }
    }
    process.env.DATABASE_URL = `postgres://postgres:${password}@${endpoint}/postgres`;
  }
  db = getDb(); assert.ok(db); const sql = db;
  await Promise.all([ensureSchema(), ensureSchema()]);
  await sql.unsafe(SCHEMA_SQL);
  const balances = new Map<string, bigint>();
  const landed = new Set<string>();
  let prepared = 0; let sends = 0; let interrupt = false;
  const tokens = new Map<string, bigint>();
  const signed = async () => { const n = ++prepared; return { lastValidBlockHeight: 1_000 + n, feeLamports: "5000", txHash: key(n, 64), rawTransaction: `raw-${n}` }; };
  const chain = {
    address: FUNDER as FaucetChain["address"],
    mintAuthority: key(0xbb) as FaucetChain["mintAuthority"],
    cluster: "devnet",
    balance: async (w: string) => w === FUNDER ? 100n * SOL : balances.get(w) ?? 0n,
    mint: async () => ({ address: key(0xcc) as FaucetChain["address"], decimals: 6, authority: key(0xbb) as FaucetChain["address"] }),
    tokenBalance: async (w: string) => tokens.get(w) ?? null,
    prepare: signed,
    prepareMint: signed,
    inspect: async (c: AnyFaucetClaim) => landed.has(c.txHash) ? "confirmed" as const : "prepared" as const,
    broadcast: async (c: AnyFaucetClaim) => {
      // A separate connection must see the row before the chain can see the bytes.
      assert.equal((await (await readFaucetStore())[c.asset].claim(c.id))?.txHash, c.txHash);
      if (interrupt) throw new Error("interrupted before broadcast");
      if (landed.has(c.txHash)) return;
      sends++; landed.add(c.txHash);
      if (c.asset === "sol") balances.set(c.wallet, (balances.get(c.wallet) ?? 0n) + BigInt(c.amountLamports));
      else tokens.set(c.wallet, (tokens.get(c.wallet) ?? 0n) + BigInt(c.amountBase));
    },
  } satisfies FaucetChain;
  const deps = { verify: async () => true };
  let service = createFaucetService(chain, deps);
  const request = async (n: number, ip = `ip-${n}`) => { const c = await service.challenge(wallet(n), ip, "https://useagari.xyz"); return service.claim(c.id, SIG, ip); };
  async function check(label: string, run: () => Promise<void>) {
    await sql`TRUNCATE sol_faucet_claims, tusdc_faucet_claims, faucet_challenges`;
    balances.clear(); tokens.clear(); landed.clear(); prepared = 0; sends = 0; interrupt = false;
    await run(); passed++; console.log(`PASS ${label}`);
  }
  await check("32 requests across service instances reserve and pay exactly once", async () => {
    const c = await service.challenge(wallet(1), "ip-1", "https://useagari.xyz");
    const all = await Promise.all(Array.from({ length: 32 }, () => createFaucetService(chain, deps).claim(c.id, SIG, "ip-1")));
    assert.equal(new Set(all.map((r) => r.txHash)).size, 1); assert.equal(sends, 1);
    assert.equal(Number((await sql`SELECT count(*) AS count FROM sol_faucet_claims`)[0]!.count), 1);
  });
  await check("competing challenges cannot bypass one-wallet cooldown", async () => {
    const challenges = await Promise.all([service.challenge(wallet(2), "ip-2", "https://useagari.xyz"), service.challenge(wallet(2), "ip-2", "https://useagari.xyz")]);
    const results = await Promise.allSettled(challenges.map((c) => service.claim(c.id, SIG, "ip-2")));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1); assert.equal(sends, 1);
  });
  await check("the rolling daily SOL allocation cannot be exceeded by another wallet", async () => {
    const perWallet = Number(POLICY.dailyLamports / POLICY.targetLamports);
    for (let n = 1; n <= perWallet; n++) await request(n);
    await assert.rejects(request(perWallet + 1), (e: unknown) => (e as { code: string }).code === "daily-limit");
    const used = await (await readFaucetStore()).sol.used(Date.now() - 86_400_000, "");
    assert.equal(used.amount, POLICY.dailyLamports); assert.equal(sends, perWallet);
  });
  await check("a failed insert rolls back and never broadcasts", async () => {
    await sql.unsafe(`CREATE FUNCTION fail_faucet_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'deliberate fixture failure'; END $$; CREATE TRIGGER fail_faucet_insert BEFORE INSERT ON sol_faucet_claims FOR EACH ROW EXECUTE FUNCTION fail_faucet_insert();`);
    try { await assert.rejects(request(1)); assert.equal(sends, 0); assert.equal((await sql`SELECT id FROM sol_faucet_claims`).length, 0); }
    finally { await sql.unsafe("DROP TRIGGER fail_faucet_insert ON sol_faucet_claims; DROP FUNCTION fail_faucet_insert();"); }
  });
  await check("restart resumes committed bytes and does not allocate twice", async () => {
    interrupt = true;
    const first = await request(1); assert.equal(first.status, "prepared");
    const before = await (await readFaucetStore()).sol.claim(first.id); assert.ok(before?.rawTransaction);
    interrupt = false; service = createFaucetService(chain, deps);
    const after = await service.claim(first.id, SIG, "new-ip");
    assert.equal(after.txHash, first.txHash); assert.equal(after.status, "confirmed"); assert.equal(sends, 1);
    assert.equal((await (await readFaucetStore()).sol.claim(first.id))?.rawTransaction, before.rawTransaction);
    await sql.unsafe(SCHEMA_SQL); assert.equal((await sql`SELECT id FROM sol_faucet_claims`).length, 1);
  });
  await check("one challenge mints tUSDC once across instances; the same id also pays SOL once", async () => {
    const c = await service.challenge(wallet(3), "ip-3", "https://useagari.xyz");
    const mints = await Promise.all(Array.from({ length: 16 }, () => createFaucetService(chain, deps).claim(c.id, SIG, "ip-3", "tusdc")));
    assert.equal(new Set(mints.map((r) => r.txHash)).size, 1);
    await service.claim(c.id, SIG, "ip-3", "sol");
    assert.equal(sends, 2); assert.equal(tokens.get(wallet(3)), TUSDC.amountUnits * 1_000_000n);
    const used = await (await readFaucetStore()).tusdc.used(Date.now() - TUSDC.cooldownMs, "ip-3");
    assert.equal(used.amount, TUSDC.amountUnits * 1_000_000n); assert.equal(used.ip, 1);
    const again = await service.challenge(wallet(3), "ip-3", "https://useagari.xyz");
    await assert.rejects(service.claim(again.id, SIG, "ip-3", "tusdc"), (e: unknown) => (e as { code: string }).code === "cooldown");
  });
  console.log(`${passed} real Postgres checks passed. No chain transactions sent.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Integration check failed"); process.exitCode = 1; }).finally(async () => {
  if (db) await db.end({ timeout: 1 });
  if (container) docker("rm", "--force", container);
});
