import { getDb } from "./client";
import { ensureSchema } from "./migrate";

export type TakeSide = "up" | "down";

/** One take as stored — the call, the words, the Window's facts at post time, and the wallet's signature. */
export interface TakeRecord {
  id: string;
  marketId: string;
  author: string;
  side: TakeSide;
  caption: string;
  asset: string;
  intervalSec: number;
  expirySec: number;
  lineRaw: string | null;
  backed: boolean;
  signature: string;
  issuedAtMs: number;
  createdAtMs: number;
}

export type NewTake = Omit<TakeRecord, "id" | "createdAtMs">;

interface TakeRow {
  id: string;
  market_id: string;
  author: string;
  side: TakeSide;
  caption: string;
  asset: string;
  interval_sec: number;
  expiry_sec: number;
  line_raw: string | null;
  backed: boolean;
  signature: string;
  issued_at_ms: string;
  created_at: Date;
}

const COLUMNS = "id, market_id, author, side, caption, asset, interval_sec, expiry_sec, line_raw, backed, signature, issued_at_ms, created_at";

const toTake = (row: TakeRow): TakeRecord => ({
  id: String(row.id),
  marketId: row.market_id,
  author: row.author,
  side: row.side,
  caption: row.caption,
  asset: row.asset,
  intervalSec: row.interval_sec,
  expirySec: row.expiry_sec,
  lineRaw: row.line_raw,
  backed: row.backed,
  signature: row.signature,
  issuedAtMs: Number(row.issued_at_ms),
  createdAtMs: row.created_at.getTime(),
});

/** Newest first, capped. `null` means no database is configured — never an empty feed. */
export async function listTakes(limit: number): Promise<TakeRecord[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<TakeRow[]>`
    SELECT ${db.unsafe(COLUMNS)}
    FROM takes
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(toTake);
}

/** The author, the signature and `backed` must already be verified by the caller; this layer does not gate. */
export async function insertTake(take: NewTake): Promise<TakeRecord | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const [row] = await db<TakeRow[]>`
    INSERT INTO takes (market_id, author, side, caption, asset, interval_sec, expiry_sec, line_raw, backed, signature, issued_at_ms)
    VALUES (
      ${take.marketId}, ${take.author.toLowerCase()}, ${take.side}, ${take.caption}, ${take.asset},
      ${take.intervalSec}, ${take.expirySec}, ${take.lineRaw}, ${take.backed}, ${take.signature}, ${take.issuedAtMs}
    )
    RETURNING ${db.unsafe(COLUMNS)}
  `;
  return row ? toTake(row) : null;
}
