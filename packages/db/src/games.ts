import { getDb } from "./client";
import { ensureSchema } from "./migrate";

/**
 * The duel projection's writes and the few reads built on it.
 *
 * Everything here is a projection of the arena's own events, never a second opinion. That is why every
 * write is an upsert keyed by something the chain decided — the match id, or a pick's coordinates — and
 * why re-reading a block is harmless: the projector is free to be restarted, rewound or run twice.
 *
 * Money is stored as decimal strings. A `NUMERIC` would be exact too, but it arrives back as a string
 * from one driver and a float from another, and the moment one of those is a float a payout is wrong by
 * an amount nobody notices. Strings in, `BigInt` out, at the one seam that knows.
 */

export type DuelStatus = "waiting" | "activeUnrevealed" | "picking" | "settling" | "finalized" | "refunded" | "forfeited";

/**
 * Every address and hash in this table is stored lowercase, and this is the one function that makes
 * that true.
 *
 * It is not tidiness. Every read here filters on `lower(...)` of what the caller passed, while the
 * writes took whatever the decoder produced — and viem returns a checksummed address from an event
 * log. So `duel_matches` filled up with `0xec71498B...` while `listLiveMatches` asked for
 * `0xec71498b...`, and matched nothing, ever. The settler read "no live match in the projection"
 * through a real duel sitting one row away: no deck revealed, no card settled, no pot awarded, and
 * `activeMatchFor` could never tell a reconnecting browser which match it was in. Found by the first
 * drive that ran the settler and a browser against the same database (2026-09-04).
 */
function key(value: string): string {
  return value.toLowerCase();
}

function keyOrNull(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toLowerCase();
}

export interface DuelMatchRow {
  matchId: string;
  chainId: number;
  arena: string;
  mode: "free" | "ranked";
  tier: "free" | "t1" | "t5" | "t10";
  creator: string;
  challenger: string | null;
  status: DuelStatus;
  deckHash: string;
  deckSize: number;
  policyVersion: number;
  potPerPlayerBase: string;
}

export interface DuelCardRow {
  pickKey: string;
  matchId: string;
  cardIndex: number;
  player: string;
  marketId: string;
  side: "up" | "down";
  quantity: string;
  costBase: string;
  filledAtSec: number;
}

/** A match as the arena first wrote it. Re-running the same event changes nothing. */
export async function recordMatchCreated(row: DuelMatchRow): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`
    INSERT INTO duel_matches
      (match_id, chain_id, arena, mode, tier, creator, challenger, status, deck_hash, deck_size, policy_version, pot_per_player)
    VALUES
      (${key(row.matchId)}, ${row.chainId}, ${key(row.arena)}, ${row.mode}, ${row.tier}, ${key(row.creator)}, ${keyOrNull(row.challenger)},
       ${row.status}, ${key(row.deckHash)}, ${row.deckSize}, ${row.policyVersion}, ${row.potPerPlayerBase})
    ON CONFLICT (match_id) DO UPDATE SET status = EXCLUDED.status, challenger = COALESCE(duel_matches.challenger, EXCLUDED.challenger)
  `;
}

export interface MatchProgress {
  status: DuelStatus;
  challenger?: string | null;
  cards?: readonly string[];
  /** Only the reveal carries it, so a created row holds 0 until its deck opens. */
  policyVersion?: number | null;
  refundReason?: string | null;
  winner?: string | null;
  creatorPnlBase?: string | null;
  challengerPnlBase?: string | null;
  finalized?: boolean;
}

/**
 * A match moving on. `COALESCE` on every optional field so a later event never blanks what an earlier
 * one recorded — a projector replaying `MatchJoined` after `DeckRevealed` must not erase the deck.
 */
export async function recordMatchProgress(matchId: string, progress: MatchProgress): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`
    UPDATE duel_matches SET
      status = ${progress.status},
      challenger = COALESCE(${keyOrNull(progress.challenger)}, challenger),
      cards = COALESCE(${progress.cards ? JSON.stringify(progress.cards) : null}::jsonb, cards),
      policy_version = COALESCE(${progress.policyVersion ?? null}, policy_version),
      refund_reason = COALESCE(${progress.refundReason ?? null}, refund_reason),
      winner = COALESCE(${keyOrNull(progress.winner)}, winner),
      creator_pnl = COALESCE(${progress.creatorPnlBase ?? null}, creator_pnl),
      challenger_pnl = COALESCE(${progress.challengerPnlBase ?? null}, challenger_pnl),
      finalized_at = CASE WHEN ${progress.finalized ?? false} THEN COALESCE(finalized_at, now()) ELSE finalized_at END
    WHERE match_id = ${key(matchId)}
  `;
}

/** One pick, as the arena measured it around the fill. */
export async function recordPick(row: DuelCardRow): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`
    INSERT INTO duel_cards (pick_key, match_id, card_index, player, market_id, side, quantity, cost, filled_at_sec)
    VALUES (${key(row.pickKey)}, ${key(row.matchId)}, ${row.cardIndex}, ${key(row.player)}, ${key(row.marketId)}, ${row.side},
            ${row.quantity}, ${row.costBase}, ${row.filledAtSec})
    ON CONFLICT (pick_key) DO UPDATE SET quantity = EXCLUDED.quantity, cost = EXCLUDED.cost
  `;
}

/**
 * A card's redemption. It fills in the row the pick already wrote rather than inserting beside it —
 * the whole reason the row is keyed by the pick's coordinates and not by a log.
 */
export async function recordSettlement(pickKey: string, payoutBase: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`UPDATE duel_cards SET payout = ${payoutBase} WHERE pick_key = ${key(pickKey)}`;
}

/** How far the projector has read. Absent until it has written a block. */
export async function readCursor(name: string): Promise<bigint | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<{ block: string }[]>`SELECT block::text FROM game_cursors WHERE name = ${name}`;
  const row = rows[0];
  return row ? BigInt(row.block) : null;
}

/** Never moves backwards: a rewound projector may re-read blocks, but the cursor is a high-water mark. */
export async function writeCursor(name: string, block: bigint): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`
    INSERT INTO game_cursors (name, block, updated_at) VALUES (${name}, ${block.toString()}, now())
    ON CONFLICT (name) DO UPDATE SET block = GREATEST(game_cursors.block, EXCLUDED.block), updated_at = now()
  `;
}

const LIVE: readonly DuelStatus[] = ["waiting", "activeUnrevealed", "picking", "settling", "forfeited"];

/**
 * The match a wallet is still in, newest first — what a browser with no memory is told to resume.
 * `forfeited` counts as live because its cards still settle and its result is still owed.
 */
export async function activeMatchFor(wallet: string, chainId: number, arena: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const who = wallet.toLowerCase();
  const rows = await db<{ match_id: string }[]>`
    SELECT match_id FROM duel_matches
    WHERE chain_id = ${chainId} AND arena = ${arena.toLowerCase()}
      AND status = ANY(${LIVE as unknown as string[]})
      AND (creator = ${who} OR challenger = ${who})
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0]?.match_id ?? null;
}

export interface DuelHistoryRow extends DuelMatchRow {
  winner: string | null;
  creatorPnlBase: string | null;
  challengerPnlBase: string | null;
  createdAtMs: number;
}

/** A wallet's finished matches, newest first — the history page's one query. */
export async function listMatchesFor(wallet: string, limit = 20): Promise<DuelHistoryRow[]> {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const who = wallet.toLowerCase();
  const rows = await db<Record<string, string | number | Date | null>[]>`
    SELECT match_id, chain_id, arena, mode, tier, creator, challenger, status, deck_hash, deck_size,
           policy_version, pot_per_player, winner, creator_pnl, challenger_pnl, created_at
    FROM duel_matches
    WHERE creator = ${who} OR challenger = ${who}
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map((r) => ({
    matchId: String(r.match_id),
    chainId: Number(r.chain_id),
    arena: String(r.arena),
    mode: String(r.mode) as "free" | "ranked",
    tier: String(r.tier) as DuelMatchRow["tier"],
    creator: String(r.creator),
    challenger: r.challenger === null ? null : String(r.challenger),
    status: String(r.status) as DuelStatus,
    deckHash: String(r.deck_hash),
    deckSize: Number(r.deck_size),
    policyVersion: Number(r.policy_version),
    potPerPlayerBase: String(r.pot_per_player),
    winner: r.winner === null ? null : String(r.winner),
    creatorPnlBase: r.creator_pnl === null ? null : String(r.creator_pnl),
    challengerPnlBase: r.challenger_pnl === null ? null : String(r.challenger_pnl),
    createdAtMs: r.created_at instanceof Date ? r.created_at.getTime() : 0,
  }));
}

export interface RatingRow {
  wallet: string;
  rating: number;
  verifiedMatches: number;
}

const NEW_RATING = { rating: 1_000, verifiedMatches: 0 };

/** Two players' ladder records, defaulting a wallet that has never played rather than refusing it. */
export async function readRatings(wallets: readonly string[]): Promise<Map<string, RatingRow>> {
  const out = new Map<string, RatingRow>();
  const db = getDb();
  const keys = wallets.map((w) => w.toLowerCase());
  for (const wallet of keys) out.set(wallet, { wallet, ...NEW_RATING });
  if (!db) return out;
  await ensureSchema();
  const rows = await db<{ wallet: string; rating: number; verified_matches: number }[]>`
    SELECT wallet, rating, verified_matches FROM game_ratings WHERE wallet = ANY(${keys as string[]})
  `;
  for (const row of rows) out.set(row.wallet, { wallet: row.wallet, rating: row.rating, verifiedMatches: row.verified_matches });
  return out;
}

export interface RatingUpdate extends RatingRow {
  delta: number;
}

/**
 * Both players' new ratings, applied exactly once for a match.
 *
 * The `game_rating_events` insert is the lock: it is keyed by the match and the wallet, so a replayed
 * block loses the race with itself and the rating is left alone. One transaction, both players, so a
 * crash between them cannot leave one side of a result on the ladder.
 *
 * Returns true when this call was the one that moved the ladder.
 */
export async function applyRatingsOnce(matchId: string, updates: readonly RatingUpdate[]): Promise<boolean> {
  const db = getDb();
  if (!db || updates.length === 0) return false;
  await ensureSchema();
  return db.begin(async (tx) => {
    for (const update of updates) {
      const wallet = update.wallet.toLowerCase();
      const claimed = await tx`
        INSERT INTO game_rating_events (match_id, wallet, delta, rating_after)
        VALUES (${matchId}, ${wallet}, ${update.delta}, ${update.rating})
        ON CONFLICT (match_id, wallet) DO NOTHING
        RETURNING wallet
      `;
      if (claimed.length === 0) return false;
      await tx`
        INSERT INTO game_ratings (wallet, rating, verified_matches, updated_at)
        VALUES (${wallet}, ${update.rating}, ${update.verifiedMatches}, now())
        ON CONFLICT (wallet) DO UPDATE SET rating = EXCLUDED.rating, verified_matches = EXCLUDED.verified_matches, updated_at = now()
      `;
    }
    return true;
  });
}

/** Every match still owed something — the settler's worklist, and the reason it needs no memory. */
export async function listLiveMatches(chainId: number, arena: string, limit = 50): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const rows = await db<{ match_id: string }[]>`
    SELECT match_id FROM duel_matches
    WHERE chain_id = ${chainId} AND arena = ${arena.toLowerCase()} AND status = ANY(${LIVE as unknown as string[]})
    ORDER BY created_at ASC LIMIT ${limit}
  `;
  return rows.map((r) => r.match_id);
}

/** Whether a games store exists at all — so a page can say "not connected here" instead of "no matches". */
export function gamesStoreConfigured(): boolean {
  return getDb() !== null;
}

/**
 * Finished ranked duels per wallet — the season's eligibility count, Flicky's `stakedDuelCounts`. A duel
 * counts once for each seat, only when the pot was decided (`finalized`): a refund is not a duel played.
 * With no wallets asked for, every wallet with at least one is returned — the payout tool's whole list.
 */
export async function countRankedFinalized(wallets: readonly string[] | null = null): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const db = getDb();
  if (!db) return out;
  await ensureSchema();
  const keys = wallets?.map((w) => w.toLowerCase()) ?? null;
  const rows = await db<{ wallet: string; n: string }[]>`
    SELECT wallet, count(*)::text AS n FROM (
      SELECT creator AS wallet FROM duel_matches WHERE mode = 'ranked' AND status = 'finalized'
      UNION ALL
      SELECT challenger AS wallet FROM duel_matches WHERE mode = 'ranked' AND status = 'finalized' AND challenger IS NOT NULL
    ) seats
    WHERE ${keys === null ? db`TRUE` : db`wallet = ANY(${keys as string[]})`}
    GROUP BY wallet
  `;
  for (const row of rows) out.set(row.wallet, Number(row.n));
  return out;
}

/** A wallet's 1-based place on the ladder in the ladder's own order, or null when it has no rating yet. */
export async function ladderRankOf(wallet: string): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<{ place: string }[]>`
    SELECT place::text FROM (
      SELECT wallet, row_number() OVER (ORDER BY rating DESC, verified_matches DESC, wallet ASC) AS place FROM game_ratings
    ) ladder WHERE wallet = ${wallet.toLowerCase()}
  `;
  const row = rows[0];
  return row ? Number(row.place) : null;
}

/** The ladder, top first — Flicky's `/leaderboard`, over the ratings the settler already keeps. */
export async function listTopRatings(limit = 50): Promise<RatingRow[]> {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const rows = await db<{ wallet: string; rating: number; verified_matches: number }[]>`
    SELECT wallet, rating, verified_matches FROM game_ratings
    ORDER BY rating DESC, verified_matches DESC, wallet ASC LIMIT ${limit}
  `;
  return rows.map((row) => ({ wallet: row.wallet, rating: row.rating, verifiedMatches: row.verified_matches }));
}
