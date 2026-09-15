import { getDb } from "./client";
import { ensureSchema } from "./migrate";
import { storageKey } from "./keys";

/**
 * The one directional follow graph (`game_follows`, schema-games.ts): S13's profiles and activity feed write and read
 * it, and S12a's Friends board reads the same rows. No approval handshake, so following is never blocked on someone
 * else acting; a mutual pair is two rows.
 *
 * Writers (AD-7): web only, behind a social session token the route verified from the wallet's signature. This layer
 * does not gate. Every export answers `null` when no database is configured — never an empty graph.
 */

/** A followee list is read whole by the Friends board and the following feed; past this, the oldest follows drop off. */
export const FOLLOWEES_MAX = 500;

export interface FollowCounts {
  followers: number;
  following: number;
}

/** True when the edge is new, false when it already existed. A self-follow is refused by the table's CHECK, so it is refused here first. */
export async function follow(follower: string, followee: string): Promise<boolean | null> {
  const db = getDb();
  if (!db) return null;
  if (follower === followee) return false;
  await ensureSchema();
  const rows = await db`
    INSERT INTO game_follows (follower, followee)
    VALUES (${storageKey(follower)}, ${storageKey(followee)})
    ON CONFLICT (follower, followee) DO NOTHING
    RETURNING 1
  `;
  return rows.length > 0;
}

/** True when an edge was removed. */
export async function unfollow(follower: string, followee: string): Promise<boolean | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db`
    DELETE FROM game_follows WHERE follower = ${storageKey(follower)} AND followee = ${storageKey(followee)}
    RETURNING 1
  `;
  return rows.length > 0;
}

/** Who this wallet follows, newest first. Served by the primary key's `follower` prefix. */
export async function followees(wallet: string, limit = FOLLOWEES_MAX): Promise<string[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<{ followee: string }[]>`
    SELECT followee FROM game_follows WHERE follower = ${storageKey(wallet)}
    ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(FOLLOWEES_MAX, limit))}
  `;
  return rows.map((row) => row.followee);
}

/** Who follows this wallet, newest first (`game_follows_followee_idx`). */
export async function followers(wallet: string, limit = FOLLOWEES_MAX): Promise<string[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<{ follower: string }[]>`
    SELECT follower FROM game_follows WHERE followee = ${storageKey(wallet)}
    ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(FOLLOWEES_MAX, limit))}
  `;
  return rows.map((row) => row.follower);
}

/** Both counts in one round trip. */
export async function counts(wallet: string): Promise<FollowCounts | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const key = storageKey(wallet);
  const [row] = await db<{ followers: number; following: number }[]>`
    SELECT (SELECT count(*) FROM game_follows WHERE followee = ${key})::int AS followers,
           (SELECT count(*) FROM game_follows WHERE follower = ${key})::int AS following
  `;
  return row ? { followers: row.followers, following: row.following } : { followers: 0, following: 0 };
}
