import { getDb } from "./client";
import { ensureSchema } from "./migrate";

/**
 * Arcade scores: product state with no chain counterpart, and the one games table the web writes.
 *
 * A row is a run the server replayed. It is never updated: a wallet's best is the greatest of its rows,
 * a board is one row per wallet, and a rank is how many wallets have a greater best. Rows are keyed by
 * the engine build they were made on, because a score from another build is not comparable and must
 * not sit on the same board.
 *
 * Wallets are lowercased at the write, and only here — the lesson `games.ts` records.
 */
export type ArcadeGameId = "line-rider" | "candle-hop";

export interface ArcadeScoreInput {
  game: ArcadeGameId;
  wallet: string;
  score: number;
  engineVersion: number;
  durationMs: number;
  seed: string;
  traceHash: string;
  calm: boolean;
}

export interface ArcadeBoardRow {
  wallet: string;
  score: number;
  calm: boolean;
  /** ISO 8601, when the best was set. */
  at: string;
}

function key(value: string): string {
  return value.toLowerCase();
}

export async function recordArcadeScore(input: ArcadeScoreInput): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`
    INSERT INTO arcade_scores (game, wallet, score, engine_version, duration_ms, checked, seed, trace_hash, calm)
    VALUES (${input.game}, ${key(input.wallet)}, ${input.score}, ${input.engineVersion}, ${input.durationMs}, 'replayed',
            ${input.seed}, ${input.traceHash}, ${input.calm})
  `;
}

/** The board: each wallet's best on this build, greatest first, the earlier of equals ahead. */
export async function listArcadeBoard(game: ArcadeGameId, engineVersion: number, limit = 10): Promise<ArcadeBoardRow[]> {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const rows = await db<{ wallet: string; score: number; calm: boolean; created_at: Date }[]>`
    SELECT wallet, score, calm, created_at FROM (
      SELECT DISTINCT ON (wallet) wallet, score, calm, created_at
      FROM arcade_scores
      WHERE game = ${game} AND engine_version = ${engineVersion}
      ORDER BY wallet, score DESC, created_at ASC
    ) best
    ORDER BY score DESC, created_at ASC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ wallet: row.wallet, score: row.score, calm: row.calm, at: row.created_at.toISOString() }));
}

/** A wallet's best on this build, or null when it has no run here. */
export async function bestArcadeOf(wallet: string, game: ArcadeGameId, engineVersion: number): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<{ best: number | null }[]>`
    SELECT max(score) AS best FROM arcade_scores
    WHERE game = ${game} AND engine_version = ${engineVersion} AND wallet = ${key(wallet)}
  `;
  const best = rows[0]?.best;
  return best === null || best === undefined ? null : Number(best);
}

/** Where a score stands: one more than the number of wallets whose best beats it. Equal bests share a rank. */
export async function arcadeRankOf(game: ArcadeGameId, engineVersion: number, score: number): Promise<number> {
  const db = getDb();
  if (!db) return 1;
  await ensureSchema();
  const rows = await db<{ n: string }[]>`
    SELECT count(*)::text AS n FROM (
      SELECT wallet, max(score) AS best FROM arcade_scores
      WHERE game = ${game} AND engine_version = ${engineVersion}
      GROUP BY wallet
    ) bests
    WHERE bests.best > ${score}
  `;
  return Number(rows[0]?.n ?? 0) + 1;
}
