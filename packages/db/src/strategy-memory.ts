import { getDb } from "./client";
import { storageKey } from "./keys";
import { ensureSchema } from "./migrate";

/**
 * Sealed memory (the Memory Market, L-56): a creator's notes that only a subscriber may read.
 *
 * This layer does not gate. The publishing route verifies the creator's signature and that they are the strategy's
 * on-chain creator; the reading route verifies the reader's signature and their on-chain subscription. What this
 * layer does guarantee is that the index never carries a body, so nothing that lists the market can leak one.
 */
export interface SealedMemoryIndexRow {
  strategyId: string;
  creator: string;
  title: string;
  chars: number;
  updatedAtMs: number;
}

export async function upsertSealedMemory(strategyId: string, creator: string, title: string, body: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await ensureSchema();
  await db`
    INSERT INTO strategy_sealed_memory (strategy_id, creator, title, body) VALUES (${strategyId}, ${storageKey(creator)}, ${title}, ${body})
    ON CONFLICT (strategy_id) DO UPDATE SET creator = EXCLUDED.creator, title = EXCLUDED.title, body = EXCLUDED.body, updated_at = now()
  `;
  return true;
}

/** Everything a visitor may know: that a memory exists, what it is called and how long it is. Never the body. */
export async function listSealedMemoryIndex(): Promise<SealedMemoryIndexRow[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<Array<{ strategy_id: string; creator: string; title: string; chars: number; updated_at: Date }>>`
    SELECT strategy_id, creator, title, length(body)::int AS chars, updated_at FROM strategy_sealed_memory
  `;
  return rows.map((r) => ({ strategyId: r.strategy_id, creator: r.creator, title: r.title, chars: r.chars, updatedAtMs: r.updated_at.getTime() }));
}

/** The body itself. Only the gated route calls this, after it has verified who is asking. */
export async function readSealedMemory(strategyId: string): Promise<{ creator: string; title: string; body: string; updatedAtMs: number } | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<Array<{ creator: string; title: string; body: string; updated_at: Date }>>`
    SELECT creator, title, body, updated_at FROM strategy_sealed_memory WHERE strategy_id = ${strategyId}
  `;
  const row = rows[0];
  return row ? { creator: row.creator, title: row.title, body: row.body, updatedAtMs: row.updated_at.getTime() } : null;
}
