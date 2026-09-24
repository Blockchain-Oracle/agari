/**
 * The push device registry and sent journal over `push_devices` / `push_sent` (S26.4). Every export returns null when
 * no `DATABASE_URL` is configured, so a deployment without Postgres says push is unavailable instead of pretending.
 */
import { getDb } from "./client";
import { ensureSchema } from "./migrate";

export type PushKind = "fills" | "results" | "payouts";
export type PushPlatform = "ios" | "android";

export interface PushDevice {
  expoToken: string;
  wallet: string;
  platform: PushPlatform;
  kinds: PushKind[];
  sinceSec: number;
}

/** A sent-journal row older than this can no longer be re-announced (the drain never reads that far back). */
const SENT_KEEP_MS = 7 * 86_400_000;

type Row = Record<string, unknown>;
const toDevice = (r: Row): PushDevice => ({
  expoToken: r.expo_token as string,
  wallet: r.wallet as string,
  platform: r.platform as PushPlatform,
  kinds: r.kinds as PushKind[],
  sinceSec: Number(r.since_sec),
});

/**
 * Registers (or re-enables) one install for one wallet. Its cursor restarts at `nowMs` only when the wallet changes
 * or the device was off, so a phone that re-registers on every launch never re-hears or skips what it was owed.
 */
export async function registerPushDevice(input: { expoToken: string; wallet: string; secretHash: string; platform: PushPlatform; kinds: PushKind[]; nowMs: number }): Promise<PushDevice | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const sinceSec = Math.floor(input.nowMs / 1000);
  const rows = await db`
    INSERT INTO push_devices (expo_token, wallet, secret_hash, platform, kinds, since_sec, disabled_at_ms, created_at_ms, updated_at_ms)
    VALUES (${input.expoToken}, ${input.wallet}, ${input.secretHash}, ${input.platform}, ${input.kinds}, ${sinceSec}, NULL, ${input.nowMs}, ${input.nowMs})
    ON CONFLICT (expo_token) DO UPDATE SET
      since_sec = CASE WHEN push_devices.wallet <> EXCLUDED.wallet OR push_devices.disabled_at_ms IS NOT NULL THEN EXCLUDED.since_sec ELSE push_devices.since_sec END,
      wallet = EXCLUDED.wallet,
      secret_hash = EXCLUDED.secret_hash,
      platform = EXCLUDED.platform,
      kinds = EXCLUDED.kinds,
      disabled_at_ms = NULL,
      updated_at_ms = EXCLUDED.updated_at_ms
    RETURNING *`;
  return rows[0] ? toDevice(rows[0]) : null;
}

/** Changes what one install hears, or turns it off (`kinds` null). Only the registration's secret can. */
export async function updatePushDevice(input: { expoToken: string; secretHash: string; kinds: PushKind[] | null; nowMs: number }): Promise<PushDevice | "unknown" | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows =
    input.kinds === null
      ? await db`UPDATE push_devices SET disabled_at_ms = ${input.nowMs}, updated_at_ms = ${input.nowMs} WHERE expo_token = ${input.expoToken} AND secret_hash = ${input.secretHash} RETURNING *`
      : await db`UPDATE push_devices SET kinds = ${input.kinds}, updated_at_ms = ${input.nowMs} WHERE expo_token = ${input.expoToken} AND secret_hash = ${input.secretHash} AND disabled_at_ms IS NULL RETURNING *`;
  return rows[0] ? toDevice(rows[0]) : "unknown";
}

/** Expo said these tokens are dead: stop sending to them whatever wallet they name. */
export async function retirePushTokens(expoTokens: readonly string[], nowMs: number): Promise<void> {
  const db = getDb();
  if (!db || expoTokens.length === 0) return;
  await ensureSchema();
  await db`UPDATE push_devices SET disabled_at_ms = ${nowMs}, updated_at_ms = ${nowMs} WHERE expo_token IN ${db(expoTokens as string[])}`;
}

/** Every enabled device, oldest wallet first; `limit` bounds one drain. */
export async function listPushDevices(limit: number): Promise<PushDevice[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db`SELECT * FROM push_devices WHERE disabled_at_ms IS NULL ORDER BY wallet, created_at_ms LIMIT ${limit}`;
  return rows.map(toDevice);
}

/** The item ids already sent to these devices. */
export async function sentPushIds(expoTokens: readonly string[]): Promise<Map<string, Set<string>> | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const out = new Map<string, Set<string>>();
  if (expoTokens.length === 0) return out;
  const rows = await db`SELECT expo_token, item_id FROM push_sent WHERE expo_token IN ${db(expoTokens as string[])}`;
  for (const r of rows) {
    const token = r.expo_token as string;
    if (!out.has(token)) out.set(token, new Set());
    out.get(token)!.add(r.item_id as string);
  }
  return out;
}

/** Journals what went out, then forgets rows too old to matter. */
export async function recordPushSent(rows: readonly { expoToken: string; itemId: string }[], nowMs: number): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  if (rows.length > 0) {
    const values = rows.map((r) => ({ expo_token: r.expoToken, item_id: r.itemId, sent_at_ms: nowMs }));
    await db`INSERT INTO push_sent ${db(values)} ON CONFLICT DO NOTHING`;
  }
  await db`DELETE FROM push_sent WHERE sent_at_ms < ${nowMs - SENT_KEEP_MS}`;
}
