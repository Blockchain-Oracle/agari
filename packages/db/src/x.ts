import { getDb } from "./client";
import { ensureSchema } from "./migrate";
import { z } from "zod";

export interface XLinkRecord {
  authorId: string;
  handle: string | null;
  wallet: string;
  signature: string;
  issuedAtMs: number;
  createdAtMs: number;
}

export type XReceiptStatusRow = "refused" | "submitted" | "filled" | "nothing-filled" | "reverted" | "unknown";

const baseUnits = z.string().regex(/^(0|[1-9]\d{0,77})$/);
const receiptDetailsSchema = z.object({
  bookedCostBase: baseUnits.nullish(),
  bookedContractsRaw: baseUnits.nullish(),
  avgPriceBps: z.number().int().nonnegative().nullish(),
  asset: z.string().max(32).nullish(),
  intervalSec: z.number().int().positive().nullish(),
  expirySec: z.number().int().nonnegative().nullish(),
  refusalCode: z.enum([
    "account-not-linked", "instruction-invalid", "balance-unavailable", "not-deployed",
    "grant-missing", "grant-mismatch", "grant-expired", "no-window", "quote-unavailable",
    "no-liquidity", "price-moved", "permission-denied", "insufficient-funds", "execution-unavailable", "unconfirmed",
    "grant-update-required", "position-limit", "price-limit", "execution-paused",
    "market-data-unavailable", "window-entry-closed", "window-not-started", "opening-price-pending",
  ]).nullish(),
  parseRefusal: z.enum(["empty", "no-side", "two-sides", "no-asset", "unknown-asset", "two-assets", "no-stake", "bad-stake", "two-stakes", "no-cadence", "cadence-not-listed", "two-cadences", "unknown-token"]).nullish(),
  entryClosesAtSec: z.number().int().nonnegative().nullish(),
  nextWindowAtSec: z.number().int().nonnegative().nullish(),
  executionActor: z.string().regex(/^0x[0-9a-fA-F]{40}$/).nullish(),
  poolAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).nullish(),
  collateralDecimals: z.number().int().min(0).max(18).nullish(),
  intentRecordedAtMs: z.number().int().nonnegative().nullish(),
  journalState: z.enum(["recorded", "sent", "confirmed", "failed", "unknown"]).nullish(),
  recoveryFromBlock: baseUnits.nullish(),
  expectedNonce: z.number().int().nonnegative().safe().nullish(),
});

export type XReceiptDetailsRecord = z.infer<typeof receiptDetailsSchema>;

export interface XReceiptRecord extends XReceiptDetailsRecord {
  mentionId: string;
  authorId: string;
  handle: string | null;
  wallet: string | null;
  grantId: string | null;
  marketId: string | null;
  side: "up" | "down" | null;
  /** Requested stake; never overwritten with the actual booked amount. */
  stakeBase: string | null;
  status: XReceiptStatusRow;
  reason: string | null;
  txHash: string | null;
  instruction: string;
  atMs: number;
}

interface LinkRow {
  author_id: string;
  handle: string | null;
  wallet: string;
  signature: string;
  issued_at_ms: string;
  created_at: Date;
}

interface ReceiptRow {
  mention_id: string;
  author_id: string;
  handle: string | null;
  wallet: string | null;
  grant_id: string | null;
  market_id: string | null;
  side: "up" | "down" | null;
  stake_base: string | null;
  details?: unknown;
  status: XReceiptStatusRow;
  reason: string | null;
  tx_hash: string | null;
  instruction: string;
  at_ms: string;
}

const LINK_COLUMNS = "author_id, handle, wallet, signature, issued_at_ms, created_at";
const RECEIPT_COLUMNS = "mention_id, author_id, handle, wallet, grant_id, market_id, side, stake_base, details, status, reason, tx_hash, instruction, at_ms";

function readReceiptDetails(value: unknown): XReceiptDetailsRecord {
  const parsed = receiptDetailsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

const toLink = (row: LinkRow): XLinkRecord => ({
  authorId: row.author_id,
  handle: row.handle,
  wallet: row.wallet,
  signature: row.signature,
  issuedAtMs: Number(row.issued_at_ms),
  createdAtMs: row.created_at.getTime(),
});

const toReceipt = (row: ReceiptRow): XReceiptRecord => ({
  ...readReceiptDetails(row.details),
  mentionId: row.mention_id,
  authorId: row.author_id,
  handle: row.handle,
  wallet: row.wallet,
  grantId: row.grant_id,
  marketId: row.market_id,
  side: row.side,
  stakeBase: row.stake_base,
  status: row.status,
  reason: row.reason,
  txHash: row.tx_hash,
  instruction: row.instruction,
  atMs: Number(row.at_ms),
});

/** The live link for an X account, or null. `undefined`-free: a missing store answers null like an unlinked account would — callers gate on `isDbConfigured()` first. */
export async function xLinkByAuthor(authorId: string): Promise<XLinkRecord | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const [row] = await db<LinkRow[]>`SELECT ${db.unsafe(LINK_COLUMNS)} FROM x_links WHERE author_id = ${authorId} AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`;
  return row ? toLink(row) : null;
}

export async function xLinkByWallet(wallet: string): Promise<XLinkRecord | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const [row] = await db<LinkRow[]>`SELECT ${db.unsafe(LINK_COLUMNS)} FROM x_links WHERE wallet = ${wallet.toLowerCase()} AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`;
  return row ? toLink(row) : null;
}

/**
 * Points an X account at a wallet. One live route per X account and one per wallet: a wallet
 * re-pointed to a new account drops its old route, and an account already routed elsewhere is
 * refused here (the caller reports which wallet holds it) — the reference's `already_claimed_other`.
 */
export async function xLinkUpsert(link: Omit<XLinkRecord, "createdAtMs">): Promise<XLinkRecord | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const wallet = link.wallet.toLowerCase();
  const [row] = await db.begin(async (tx) => {
    await tx`UPDATE x_links SET revoked_at = now() WHERE revoked_at IS NULL AND (wallet = ${wallet} OR author_id = ${link.authorId})`;
    return tx<LinkRow[]>`
      INSERT INTO x_links (author_id, handle, wallet, signature, issued_at_ms)
      VALUES (${link.authorId}, ${link.handle}, ${wallet}, ${link.signature}, ${link.issuedAtMs})
      RETURNING ${tx.unsafe(LINK_COLUMNS)}
    `;
  });
  return row ? toLink(row) : null;
}

export async function xLinkRevoke(authorId: string, wallet: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await ensureSchema();
  const rows = await db`UPDATE x_links SET revoked_at = now() WHERE author_id = ${authorId} AND wallet = ${wallet.toLowerCase()} AND revoked_at IS NULL RETURNING id`;
  return rows.length > 0;
}

export async function xReceiptByMention(mentionId: string): Promise<XReceiptRecord | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const [row] = await db<ReceiptRow[]>`SELECT ${db.unsafe(RECEIPT_COLUMNS)} FROM x_receipts WHERE mention_id = ${mentionId}`;
  return row ? toReceipt(row) : null;
}

/** Inserts or replaces the receipt for one mention — the relay writes it before and after sending. */
export async function xReceiptUpsert(receipt: XReceiptRecord): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  // postgres.js serializes json parameters itself; stringifying first stores a JSON string.
  const details = readReceiptDetails(receipt);
  await db`
    INSERT INTO x_receipts (mention_id, author_id, handle, wallet, grant_id, market_id, side, stake_base, details, status, reason, tx_hash, instruction, at_ms)
    VALUES (
      ${receipt.mentionId}, ${receipt.authorId}, ${receipt.handle}, ${receipt.wallet}, ${receipt.grantId}, ${receipt.marketId},
      ${receipt.side}, ${receipt.stakeBase}, ${db.json(details)}::jsonb, ${receipt.status}, ${receipt.reason}, ${receipt.txHash}, ${receipt.instruction}, ${receipt.atMs}
    )
    ON CONFLICT (mention_id) DO UPDATE SET
      wallet = EXCLUDED.wallet, grant_id = EXCLUDED.grant_id, market_id = EXCLUDED.market_id, side = EXCLUDED.side,
      stake_base = EXCLUDED.stake_base,
      details = (CASE WHEN jsonb_typeof(x_receipts.details) = 'object' THEN x_receipts.details ELSE '{}'::jsonb END) || EXCLUDED.details,
      status = EXCLUDED.status, reason = EXCLUDED.reason, tx_hash = COALESCE(EXCLUDED.tx_hash, x_receipts.tx_hash), updated_at = now()
    WHERE NOT (x_receipts.status IN ('filled', 'nothing-filled', 'reverted') AND EXCLUDED.status IN ('submitted', 'unknown', 'refused'))
      AND (x_receipts.tx_hash IS NULL OR EXCLUDED.tx_hash IS NULL OR x_receipts.tx_hash = EXCLUDED.tx_hash)
  `;
}

/** Record broadcast evidence directly on its durable mention; a different hash is never substituted. */
export async function xRecordExecutionJournal(mentionId: string, patch: XReceiptDetailsRecord, txHash?: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("X execution requires a database");
  await ensureSchema();
  if (txHash !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error("Invalid transaction hash");
  const rows = await db`
    UPDATE x_receipts SET
      details = (CASE WHEN jsonb_typeof(details) = 'object' THEN details ELSE '{}'::jsonb END) || ${db.json(receiptDetailsSchema.parse(patch))}::jsonb,
      tx_hash = COALESCE(${txHash ?? null}, tx_hash), updated_at = now()
    WHERE mention_id = ${mentionId} AND status IN ('submitted', 'unknown')
      AND (${txHash ?? null}::text IS NULL OR tx_hash IS NULL OR tx_hash = ${txHash ?? null})
    RETURNING mention_id
  `;
  if (rows.length !== 1) throw new Error("X execution evidence was not stored");
}

/** Recover old claims and known uncertain transactions without ever acquiring execution permission. */
export async function xRecoveryCandidates(limit = 20): Promise<XReceiptRecord[]> {
  const db = getDb();
  if (!db) throw new Error("X recovery requires a database");
  await ensureSchema();
  const rows = await db<ReceiptRow[]>`
    SELECT ${db.unsafe(RECEIPT_COLUMNS)} FROM x_receipts
    WHERE (status = 'submitted' AND updated_at < now() - interval '5 minutes')
      OR (status = 'unknown' AND (tx_hash IS NOT NULL OR details->>'intentRecordedAtMs' IS NOT NULL) AND updated_at < now() - interval '15 seconds')
    ORDER BY updated_at LIMIT ${limit}
  `;
  return rows.map(toReceipt);
}

/** Compare against the snapshot read by recovery so it cannot overwrite a later final result or hash. */
export async function xStoreRecoveredReceipt(before: XReceiptRecord, after: XReceiptRecord): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("X recovery requires a database");
  await ensureSchema();
  const rows = await db`
    UPDATE x_receipts SET status = ${after.status}, reason = ${after.reason}, tx_hash = COALESCE(${after.txHash}, tx_hash),
      details = (CASE WHEN jsonb_typeof(details) = 'object' THEN details ELSE '{}'::jsonb END) || ${db.json(readReceiptDetails(after))}::jsonb,
      updated_at = now()
    WHERE mention_id = ${before.mentionId} AND status = ${before.status}
      AND tx_hash IS NOT DISTINCT FROM ${before.txHash}
    RETURNING mention_id
  `;
  return rows.length === 1;
}

/** Do not reuse an executor nonce while its prior broadcast is uncertain. */
export async function xHasUnresolvedBroadcast(actor: string): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("X execution requires a database");
  await ensureSchema();
  const [row] = await db<{ blocked: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM x_receipts WHERE status IN ('submitted', 'unknown') AND tx_hash IS NULL
      AND lower(details->>'executionActor') = ${actor.toLowerCase()} AND details->>'intentRecordedAtMs' IS NOT NULL) AS blocked
  `;
  return row?.blocked ?? true;
}

export async function xReceiptsByWallet(wallet: string, limit: number): Promise<XReceiptRecord[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  // A historical relay reply can have a receipt from the old recursive poller. Keep its audit row,
  // but do not present that bot output as an instruction from this wallet.
  const rows = await db<ReceiptRow[]>`
    SELECT ${db.unsafe(RECEIPT_COLUMNS)} FROM x_receipts r WHERE r.wallet = ${wallet.toLowerCase()}
      AND NOT EXISTS (SELECT 1 FROM x_reply_delivery d WHERE d.reply_id = r.mention_id)
    ORDER BY r.at_ms DESC LIMIT ${limit}
  `;
  return rows.map(toReceipt);
}

export async function xRelayStateGet(key: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const [row] = await db<{ value: string }[]>`SELECT value FROM x_relay_state WHERE key = ${key}`;
  return row?.value ?? null;
}

export async function xRelayStateSet(key: string, value: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`INSERT INTO x_relay_state (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}
