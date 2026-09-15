import { getDb } from "./client";
import { ensureSchema } from "./migrate";
import { storageKey } from "./keys";
import { insertTakeTags } from "./take-tags";

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
  /** The registry tickers it is filed under (`take_tags`), alphabetical. */
  tags: string[];
}

export type NewTake = Omit<TakeRecord, "id" | "createdAtMs">;

/** A page of the feed: venue-wide, or narrowed to one ticker's tag and/or a set of authors. */
export interface TakesQuery {
  limit: number;
  /** A registry ticker, as tagged (`TSLA`). */
  symbol?: string;
  /** Base58 authors; an empty list matches nothing, an absent one does not filter. */
  authors?: readonly string[];
}

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
  tags: string[] | null;
}

const FIELDS = ["id", "market_id", "author", "side", "caption", "asset", "interval_sec", "expiry_sec", "line_raw", "backed", "signature", "issued_at_ms", "created_at"];
const COLUMNS = FIELDS.join(", ");
const TAKE_COLUMNS = FIELDS.map((field) => `t.${field}`).join(", ");

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
  tags: row.tags ?? [],
});

/** Newest first, capped. `null` means no database is configured — never an empty feed. */
export async function listTakes(query: TakesQuery): Promise<TakeRecord[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const authors = query.authors?.map(storageKey);
  const rows = await db<TakeRow[]>`
    SELECT ${db.unsafe(TAKE_COLUMNS)},
      (SELECT array_agg(g.symbol ORDER BY g.symbol) FROM take_tags g WHERE g.take_id = t.id) AS tags
    FROM takes t
    WHERE true
      ${query.symbol ? db`AND t.id IN (SELECT g.take_id FROM take_tags g WHERE g.symbol = ${query.symbol})` : db``}
      ${authors ? db`AND t.author = ANY(${authors as string[]}::text[])` : db``}
    ORDER BY t.created_at DESC
    LIMIT ${query.limit}
  `;
  return rows.map(toTake);
}

/**
 * The take and its tags in one transaction. The author, the signature, `backed` and the tags must already be
 * verified by the caller; this layer does not gate.
 */
export async function insertTake(take: NewTake): Promise<TakeRecord | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const stored = await db.begin(async (tx) => {
    const [row] = await tx<TakeRow[]>`
      INSERT INTO takes (market_id, author, side, caption, asset, interval_sec, expiry_sec, line_raw, backed, signature, issued_at_ms)
      VALUES (
        ${take.marketId}, ${storageKey(take.author)}, ${take.side}, ${take.caption}, ${take.asset},
        ${take.intervalSec}, ${take.expirySec}, ${take.lineRaw}, ${take.backed}, ${take.signature}, ${take.issuedAtMs}
      )
      RETURNING ${tx.unsafe(COLUMNS)}
    `;
    if (!row) return null;
    const tags = await insertTakeTags(tx, String(row.id), take.tags);
    return { ...row, tags: [...tags].sort() };
  });
  return stored ? toTake(stored as TakeRow) : null;
}
