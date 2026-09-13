import { getDb } from "./client";
import { ensureSchema } from "./migrate";

export interface RoomComment {
  id: string;
  marketId: string;
  author: string;
  body: string;
  createdAtMs: number;
}

interface CommentRow {
  id: string;
  market_id: string;
  author: string;
  body: string;
  created_at: Date;
}

const toComment = (row: CommentRow): RoomComment => ({
  id: String(row.id),
  marketId: row.market_id,
  author: row.author,
  body: row.body,
  createdAtMs: row.created_at.getTime(),
});

/** Newest first, capped. `null` means no database is configured — never an empty room. */
export async function listComments(marketId: string, limit: number): Promise<RoomComment[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<CommentRow[]>`
    SELECT id, market_id, author, body, created_at
    FROM room_comments
    WHERE market_id = ${marketId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(toComment).reverse();
}

/** The author must already be verified by the caller; this layer does not gate. */
export async function insertComment(marketId: string, author: string, body: string): Promise<RoomComment | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const [row] = await db<CommentRow[]>`
    INSERT INTO room_comments (market_id, author, body)
    VALUES (${marketId}, ${author.toLowerCase()}, ${body})
    RETURNING id, market_id, author, body, created_at
  `;
  return row ? toComment(row) : null;
}
