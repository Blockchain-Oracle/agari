import type postgres from "postgres";
import { getDb } from "./client";
import { ensureSchema } from "./migrate";

// Structural types keep the store independent of the app and market adapter.
export interface StoredFaucetChallenge { id: string; wallet: string; ipHash: string; message: string; createdAtMs: number; expiresAtMs: number }
export type StoredClaimStatus = "prepared" | "confirmed" | "reverted" | "conflict";
/** A server-signed faucet transaction and the block height it stays valid until (Solana has no account nonce). */
interface StoredJournaledClaim { id: string; wallet: string; funder: string; ipHash: string; feeLamports: string; lastValidBlockHeight: number; txHash: string; rawTransaction: string; status: StoredClaimStatus; createdAtMs: number }
/** A devnet SOL top-up (D-012), in lamports. */
export interface StoredFaucetClaim extends StoredJournaledClaim { asset: "sol"; amountLamports: string }
/** A server-sent tUSDC mint (D-034), in tUSDC base units. */
export interface StoredTusdcFaucetClaim extends StoredJournaledClaim { asset: "tusdc"; amountBase: string }

type Sql = postgres.Sql | postgres.TransactionSql;
type Row = Record<string, string>;
const challenge = (r: Row): StoredFaucetChallenge => ({ id: r.id!, wallet: r.wallet!, ipHash: r.ip_hash!, message: r.message!, createdAtMs: Number(r.created_at_ms), expiresAtMs: Number(r.expires_at_ms) });
const journaled = (r: Row): StoredJournaledClaim => ({ id: r.id!, wallet: r.wallet!, funder: r.funder!, ipHash: r.ip_hash!, feeLamports: r.fee_lamports!, lastValidBlockHeight: Number(r.last_valid_block_height), txHash: r.tx_hash!, rawTransaction: r.raw_transaction!, status: r.status as StoredClaimStatus, createdAtMs: Number(r.created_at_ms) });

/** One claim kind's journal. Method shorthand keeps a SOL or tUSDC journal assignable to the union's. */
export interface ClaimJournal<C> {
  claim(id: string): Promise<C | null>;
  latest(wallet: string): Promise<C | null>;
  pending(): Promise<C | null>;
  /** Everything reserved since `sinceMs`, in the kind's own unit, and how many of those came from `ipHash`. */
  used(sinceMs: number, ipHash: string): Promise<{ amount: bigint; ip: number }>;
  insert(claim: C): Promise<void>;
  mark(id: string, status: StoredClaimStatus): Promise<void>;
}

interface JournalSpec<C> { table: "sol_faucet_claims" | "tusdc_faucet_claims"; amountColumn: "amount_lamports" | "amount_base"; row: (r: Row) => C; amount: (c: C) => string }
const SOL: JournalSpec<StoredFaucetClaim> = { table: "sol_faucet_claims", amountColumn: "amount_lamports", row: (r) => ({ ...journaled(r), asset: "sol", amountLamports: r.amount_lamports! }), amount: (c) => c.amountLamports };
const TUSDC: JournalSpec<StoredTusdcFaucetClaim> = { table: "tusdc_faucet_claims", amountColumn: "amount_base", row: (r) => ({ ...journaled(r), asset: "tusdc", amountBase: r.amount_base! }), amount: (c) => c.amountBase };

function journal<C extends StoredJournaledClaim>(sql: Sql, spec: JournalSpec<C>): ClaimJournal<C> {
  const table = (sql as postgres.Sql)(spec.table);
  const amount = (sql as postgres.Sql)(spec.amountColumn);
  const one = async (rows: Promise<Row[]>) => { const [r] = await rows; return r ? spec.row(r) : null; };
  return {
    claim: (id) => one(sql<Row[]>`SELECT * FROM ${table} WHERE id = ${id}`),
    latest: (wallet) => one(sql<Row[]>`SELECT * FROM ${table} WHERE wallet = ${wallet} ORDER BY created_at_ms DESC LIMIT 1`),
    pending: () => one(sql<Row[]>`SELECT * FROM ${table} WHERE status IN ('prepared','conflict') ORDER BY created_at_ms LIMIT 1`),
    async used(sinceMs, ipHash) {
      // An unresolved/reverted attempt still counts: no retry can turn a failure into unlimited spend.
      const [r] = await sql`SELECT coalesce(sum(${amount}),0)::text AS amount, count(*) FILTER (WHERE ip_hash = ${ipHash})::int AS ip FROM ${table} WHERE created_at_ms >= ${sinceMs}`;
      return { amount: BigInt(r!.amount), ip: Number(r!.ip) };
    },
    async insert(c) {
      await sql`INSERT INTO ${table} (id, wallet, funder, ip_hash, ${amount}, fee_lamports, last_valid_block_height, tx_hash, raw_transaction, status, created_at_ms) VALUES (${c.id}, ${c.wallet}, ${c.funder}, ${c.ipHash}, ${spec.amount(c)}, ${c.feeLamports}, ${c.lastValidBlockHeight}, ${c.txHash}, ${c.rawTransaction}, ${c.status}, ${c.createdAtMs})`;
    },
    async mark(id, status) { await sql`UPDATE ${table} SET status = ${status} WHERE id = ${id} AND status = 'prepared'`; },
  };
}

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
    sol: journal(sql, SOL),
    tusdc: journal(sql, TUSDC),
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
