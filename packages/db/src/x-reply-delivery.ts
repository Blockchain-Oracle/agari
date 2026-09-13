import { randomUUID } from "node:crypto";
import { getDb } from "./client";
import { ensureSchema } from "./migrate";
import type { XReceiptRecord } from "./x";

export interface XReplyJob { mentionId: string; lease: string }

async function requiredDb() {
  const db = getDb();
  if (!db) throw new Error("X delivery requires a database");
  await ensureSchema();
  return db;
}

/** Own top-level commands remain usable; own replies must never become new financial instructions. */
export async function xIsRelayReply(mention: { id: string; authorId: string; replyTo?: string | null }, botAuthorId: string): Promise<boolean> {
  if (!/^\d+$/.test(botAuthorId)) throw new Error("X relay account identity is required");
  if (mention.authorId === botAuthorId && mention.replyTo) return true;
  const db = await requiredDb();
  const [row] = await db`SELECT 1 FROM x_reply_delivery WHERE reply_id = ${mention.id} LIMIT 1`;
  return Boolean(row);
}

/** Fence recursive jobs left by an earlier relay before delivery resumes. Preserve public acknowledgements. */
export async function xSuppressRelayReplyDeliveries(knownReplyId: string | null = null): Promise<number> {
  const db = await requiredDb();
  const rows = await db`
    UPDATE x_reply_delivery d SET state = 'failed', lease = NULL, error_code = 'relay-reply-suppressed', updated_at = now()
    WHERE d.state IN ('pending', 'preparing', 'posting', 'unknown')
      AND (d.mention_id = ${knownReplyId} OR EXISTS (SELECT 1 FROM x_reply_delivery parent WHERE parent.reply_id = d.mention_id))
    RETURNING d.mention_id
  `;
  return rows.length;
}

/** Claim the financial instruction once. Enqueue its future reply in the same transaction. */
export async function xClaimMention(receipt: XReceiptRecord, enqueueReply: boolean): Promise<boolean> {
  const db = await requiredDb();
  return db.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO x_receipts (mention_id, author_id, handle, wallet, grant_id, market_id, side, stake_base, status, reason, tx_hash, instruction, at_ms)
      VALUES (${receipt.mentionId}, ${receipt.authorId}, ${receipt.handle}, ${receipt.wallet}, ${receipt.grantId}, ${receipt.marketId},
        ${receipt.side}, ${receipt.stakeBase}, ${receipt.status}, ${receipt.reason}, ${receipt.txHash}, ${receipt.instruction}, ${receipt.atMs})
      ON CONFLICT (mention_id) DO NOTHING RETURNING mention_id
    `;
    if (rows.length === 0) return false;
    if (enqueueReply) await tx`INSERT INTO x_reply_delivery (mention_id) VALUES (${receipt.mentionId}) ON CONFLICT DO NOTHING`;
    return true;
  });
}

/** A stale render/upload can be claimed again; a started POST cannot. */
export async function xAcquireReplyDelivery(): Promise<XReplyJob | null> {
  const db = await requiredDb();
  const lease = randomUUID();
  const [row] = await db<{ mention_id: string }[]>`
    WITH candidate AS (
      SELECT d.mention_id FROM x_reply_delivery d JOIN x_receipts r USING (mention_id)
      WHERE r.status <> 'submitted' AND (d.state = 'pending' OR (d.state = 'preparing' AND d.updated_at < now() - interval '5 minutes'))
        AND NOT EXISTS (SELECT 1 FROM x_reply_delivery parent WHERE parent.reply_id = d.mention_id)
      ORDER BY d.updated_at LIMIT 1 FOR UPDATE OF d SKIP LOCKED
    )
    UPDATE x_reply_delivery d SET state = 'preparing', lease = ${lease}, attempts = attempts + 1, updated_at = now()
    FROM candidate c WHERE d.mention_id = c.mention_id RETURNING d.mention_id
  `;
  return row ? { mentionId: row.mention_id, lease } : null;
}

/** Persist the exact payload before the irreversible remote POST; stale workers cannot pass this gate. */
export async function xBeginReplyPost(job: XReplyJob, text: string, mediaId: string | null): Promise<boolean> {
  const db = await requiredDb();
  const rows = await db`
    UPDATE x_reply_delivery d SET state = 'posting', reply_text = ${text}, media_id = ${mediaId}, error_code = NULL, updated_at = now()
    WHERE d.mention_id = ${job.mentionId} AND d.lease = ${job.lease} AND d.state = 'preparing'
      AND NOT EXISTS (SELECT 1 FROM x_reply_delivery parent WHERE parent.reply_id = d.mention_id)
    RETURNING d.mention_id
  `;
  return rows.length > 0;
}

export async function xFinishReplyPost(job: XReplyJob, replyId: string): Promise<void> {
  const db = await requiredDb();
  const rows = await db`
    UPDATE x_reply_delivery SET state = 'sent', reply_id = ${replyId}, error_code = NULL, updated_at = now()
    WHERE mention_id = ${job.mentionId} AND lease = ${job.lease} AND state = 'posting' RETURNING mention_id
  `;
  if (rows.length !== 1) throw new Error("Reply delivery acknowledgement was not stored");
}

export async function xStopReplyDelivery(job: XReplyJob, state: "unknown" | "failed", code: string): Promise<void> {
  const db = await requiredDb();
  await db`
    UPDATE x_reply_delivery SET state = ${state}, error_code = ${code}, updated_at = now()
    WHERE mention_id = ${job.mentionId} AND lease = ${job.lease} AND state IN ('preparing', 'posting')
  `;
}

/** A crash during POST needs inspection, not a second POST. Original text/media remain available. */
export async function xMarkInterruptedReplyPosts(): Promise<number> {
  const db = await requiredDb();
  const rows = await db`
    UPDATE x_reply_delivery SET state = 'unknown', error_code = 'post-interrupted', updated_at = now()
    WHERE state = 'posting' AND updated_at < now() - interval '5 minutes' RETURNING mention_id
  `;
  return rows.length;
}
