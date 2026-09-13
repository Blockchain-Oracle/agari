import type postgres from "postgres";
import { getDb } from "./client";
import { ensureSchema } from "./migrate";

// Structural types keep the store independent of the app and market adapter.
export interface StoredFaucetChallenge { id: string; wallet: string; ipHash: string; message: string; createdAtMs: number; expiresAtMs: number }
export interface StoredFaucetClaim { id: string; wallet: string; funder: string; ipHash: string; amountWei: string; feeWei: string; nonce: number; txHash: string; rawTransaction: string; status: "prepared" | "confirmed" | "reverted" | "conflict"; createdAtMs: number }
type Sql = postgres.Sql | postgres.TransactionSql;
type Row = Record<string, string>;
const challenge = (r: Row): StoredFaucetChallenge => ({ id: r.id!, wallet: r.wallet!, ipHash: r.ip_hash!, message: r.message!, createdAtMs: Number(r.created_at_ms), expiresAtMs: Number(r.expires_at_ms) });
const claim = (r: Row): StoredFaucetClaim => ({ id: r.id!, wallet: r.wallet!, funder: r.funder!, ipHash: r.ip_hash!, amountWei: r.amount_wei!, feeWei: r.fee_wei!, nonce: Number(r.nonce), txHash: r.tx_hash!, rawTransaction: r.raw_transaction!, status: r.status as StoredFaucetClaim["status"], createdAtMs: Number(r.created_at_ms) });

export function faucetStore(sql: Sql) {
  return {
    async challenge(id: string) { const [r] = await sql<Row[]>`SELECT * FROM faucet_challenges WHERE id = ${id}`; return r ? challenge(r) : null; },
    async addChallenge(c: StoredFaucetChallenge) {
      await sql`INSERT INTO faucet_challenges (id, wallet, ip_hash, message, created_at_ms, expires_at_ms) VALUES (${c.id}, ${c.wallet}, ${c.ipHash}, ${c.message}, ${c.createdAtMs}, ${c.expiresAtMs})`;
    },
    async challengeCounts(wallet: string, ipHash: string, sinceMs: number) {
      const [r] = await sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE wallet = ${wallet})::int AS wallet, count(*) FILTER (WHERE ip_hash = ${ipHash})::int AS ip FROM faucet_challenges WHERE created_at_ms >= ${sinceMs}`;
      return { total: Number(r!.total), wallet: Number(r!.wallet), ip: Number(r!.ip) };
    },
    async claim(id: string) { const [r] = await sql<Row[]>`SELECT * FROM faucet_claims WHERE id = ${id}`; return r ? claim(r) : null; },
    async latest(wallet: string) { const [r] = await sql<Row[]>`SELECT * FROM faucet_claims WHERE wallet = ${wallet} ORDER BY created_at_ms DESC LIMIT 1`; return r ? claim(r) : null; },
    async pending() { const [r] = await sql<Row[]>`SELECT * FROM faucet_claims WHERE status IN ('prepared','conflict') ORDER BY created_at_ms LIMIT 1`; return r ? claim(r) : null; },
    async used(sinceMs: number, ipHash: string) {
      // An unresolved/reverted attempt still counts: no retry can turn a failure into unlimited gas spend.
      const [r] = await sql`SELECT coalesce(sum(amount_wei),0)::text AS amount, count(*) FILTER (WHERE ip_hash = ${ipHash})::int AS ip FROM faucet_claims WHERE created_at_ms >= ${sinceMs}`;
      return { amountWei: BigInt(r!.amount), ip: Number(r!.ip) };
    },
    async insert(c: StoredFaucetClaim) {
      await sql`INSERT INTO faucet_claims (id, wallet, funder, ip_hash, amount_wei, fee_wei, nonce, tx_hash, raw_transaction, status, created_at_ms) VALUES (${c.id}, ${c.wallet}, ${c.funder}, ${c.ipHash}, ${c.amountWei}, ${c.feeWei}, ${c.nonce}, ${c.txHash}, ${c.rawTransaction}, ${c.status}, ${c.createdAtMs})`;
    },
    async mark(id: string, status: StoredFaucetClaim["status"]) { await sql`UPDATE faucet_claims SET status = ${status} WHERE id = ${id} AND status = 'prepared'`; },
  };
}
export type FaucetStore = ReturnType<typeof faucetStore>;

/** One reservation at a time across every web instance, not a process-local counter. No broadcast inside this transaction. */
export async function withFaucetLock<T>(run: (store: FaucetStore) => Promise<T>): Promise<T> {
  const db = getDb();
  if (!db) throw new Error("Faucet database is unavailable");
  await ensureSchema();
  const result = await db.begin(async (tx) => {
    await tx`SET LOCAL lock_timeout = '8s'`;
    await tx`SELECT pg_advisory_xact_lock(761403915284119)`;
    return { value: await run(faucetStore(tx)) };
  });
  return result.value as T;
}

export async function readFaucetStore(): Promise<FaucetStore> {
  const db = getDb();
  if (!db) throw new Error("Faucet database is unavailable");
  await ensureSchema();
  return faucetStore(db);
}
