import { getDb } from "./client";
import { SCHEMA_SQL } from "./schema";

/**
 * A stable 64-bit key for the advisory lock. Any constant works as long as it is this schema's
 * alone; it is derived from the string "masayume.schema" once and written down rather than
 * recomputed, so it can never drift between processes.
 */
const SCHEMA_LOCK_KEY = 761_403_915_284_117n;

let migration: Promise<void> | null = null;

/**
 * Applies the schema once per process, and once at a time across processes.
 *
 * The schema is idempotent, so this is safe to call on every request and there is no migration tool
 * to run before a social surface works — a fresh `DATABASE_URL` is enough. That holds while every
 * statement is `CREATE IF NOT EXISTS`; the moment a change has to alter existing rows, this becomes
 * a real migration story.
 *
 * Two locks, because `CREATE TABLE IF NOT EXISTS` is idempotent but *not* race-safe: two callers
 * that both find the table missing will both try to insert its `pg_type` row, and the loser gets
 * `23505 duplicate key … pg_type_typname_nsp_index`. A boolean guard does not prevent that — it is
 * only set after the await, so concurrent first requests sail past it together. So:
 *
 *   - the cached promise collapses every concurrent caller in this process onto one run, and is
 *     cleared on failure so a transient outage does not poison the process for good;
 *   - `pg_advisory_xact_lock` serialises the run against other processes. It is the transactional
 *     form deliberately: it releases on commit or rollback, so a statement that throws part-way
 *     cannot strand the lock on a pooled connection.
 *
 * DDL is transactional in Postgres, so the whole schema either applies or does not.
 */
export async function ensureSchema(): Promise<void> {
  const db = getDb();
  if (!db) return;

  // `sql.begin` reserves one connection and owns the transaction; postgres.js rejects a raw
  // BEGIN/COMMIT sent through `unsafe` (UNSAFE_TRANSACTION) precisely because a pooled connection
  // could otherwise be handed out mid-transaction.
  migration ??= db
    .begin(async (tx) => {
      await tx.unsafe(`SELECT pg_advisory_xact_lock(${SCHEMA_LOCK_KEY})`);
      await tx.unsafe(SCHEMA_SQL);
    })
    .then(() => undefined);

  try {
    await migration;
  } catch (error) {
    migration = null;
    throw error;
  }
}
