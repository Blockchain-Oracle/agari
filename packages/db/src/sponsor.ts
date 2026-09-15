/**
 * The sponsor's co-sign ledger on Postgres (tap-trading.md §3, D-065). The in-process counters the service falls back
 * to are per-process: two servers, or two requests in flight, can each let a tap past the same cap. Here the whole
 * decision — read the window, apply the gates, record the row — happens inside one transaction behind an advisory
 * lock, so a co-sign is counted exactly once and a cap can never be crossed by a race.
 *
 * The gate rules themselves stay in `@agari/markets/sponsor` (`gateVerdict`): this store takes them as `decide`, so
 * there is one copy of the policy and this package keeps no dependency on the adapter.
 */
import { getDb } from "./client";
import { ensureSchema } from "./migrate";

/** One issued co-sign, in the shape the gates count (`CosignRow` in `@agari/markets/sponsor`). */
export interface CosignRecord {
  signature: string;
  signer: string;
  device: string;
  instruction: string;
  feeLamports: bigint;
  lastValidBlockHeight: bigint;
  createdAtMs: number;
}

export interface CosignLedger<L, V extends { ok: boolean }> {
  readonly kind: "db";
  admit(row: CosignRecord, limits: L, sponsorBalanceLamports: bigint): Promise<V>;
}

/** Nothing older than yesterday can count towards an hour or towards today (the gates' widest window). */
const WINDOW_MS = 86_400_000 + 3_600_000;
/** This table's own advisory lock, derived once from "agari.sponsor_cosigns" and written down rather than recomputed. */
const COSIGN_LOCK_KEY = "512744901337211";

type Row = Record<string, string>;
const toRecord = (r: Row): CosignRecord => ({
  signature: r.signature!,
  signer: r.signer!,
  device: r.device!,
  instruction: r.instruction!,
  feeLamports: BigInt(r.fee_lamports!),
  lastValidBlockHeight: BigInt(r.last_valid_block_height!),
  createdAtMs: Number(r.created_at_ms),
});

/**
 * The durable ledger, or null when no `DATABASE_URL` is configured — the caller then keeps the service's in-process
 * counters and the GET says "local counters", rather than pretending the budget is enforced.
 */
export function createDbCosignLedger<L, V extends { ok: boolean }>(
  decide: (rows: readonly CosignRecord[], row: CosignRecord, limits: L, sponsorBalanceLamports: bigint) => V,
): CosignLedger<L, V> | null {
  const db = getDb();
  if (!db) return null;
  return {
    kind: "db",
    async admit(row, limits, sponsorBalanceLamports) {
      await ensureSchema();
      return db.begin(async (sql) => {
        // One co-sign decided at a time: the read, the verdict and the insert are one step, as the local ledger's are.
        await sql`SELECT pg_advisory_xact_lock(${COSIGN_LOCK_KEY}::bigint)`;
        const rows = await sql<Row[]>`SELECT * FROM sponsor_cosigns WHERE created_at_ms > ${row.createdAtMs - WINDOW_MS}`;
        const verdict = decide(rows.map(toRecord), row, limits, sponsorBalanceLamports);
        if (verdict.ok) {
          await sql`
            INSERT INTO sponsor_cosigns (signature, signer, device, instruction, fee_lamports, last_valid_block_height, created_at_ms)
            VALUES (${row.signature}, ${row.signer}, ${row.device}, ${row.instruction}, ${row.feeLamports.toString()}, ${row.lastValidBlockHeight.toString()}, ${row.createdAtMs})
            ON CONFLICT (signature) DO NOTHING`;
        }
        return verdict;
      }) as Promise<V>;
    },
  };
}

/** The sponsor's recent spend, for an operator view: what it paid for since `sinceMs`. */
export async function recentCosigns(sinceMs: number): Promise<CosignRecord[]> {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const rows = await db<Row[]>`SELECT * FROM sponsor_cosigns WHERE created_at_ms >= ${sinceMs} ORDER BY created_at_ms DESC`;
  return rows.map(toRecord);
}
