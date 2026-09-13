import { getDb } from "./client";
import { ensureSchema } from "./migrate";

/**
 * The reveal material for a committed deck.
 *
 * One rule governs this table, and it is the reason it exists: **no durable reveal, no join.** A deck
 * commitment is published on chain at `createMatch`, and `revealDeck` re-hashes the preimage to open it.
 * Lose that preimage and the match can only ever refund — both pots home, nobody's fault, everybody's
 * disappointment. So the material is written here before a commitment is published anywhere, and the
 * matchmaker refuses to pair when it cannot write it (`06-game-architecture.md` §Matchmaking).
 *
 * It is stored sealed because `revealDeck` is permissionless: anyone holding this preimage can open the
 * deck early, which would hand one player the cards before the other. The key is not in the database.
 */

export interface SealedDeck {
  matchId: string;
  chainId: number;
  arena: string;
  policyVersion: number;
  lane: "15m" | "1h" | "mixed";
  cards: readonly string[];
  /** AES-256-GCM, `iv.ciphertext.tag` in base64url. The key lives in the environment, never here. */
  sealed: string;
}

/** Writes the material. Fails loudly rather than returning false: a silent miss here loses a match. */
export async function putDeck(deck: SealedDeck): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("no DATABASE_URL: a deck cannot be committed without somewhere to keep its reveal");
  await ensureSchema();
  await db`
    INSERT INTO duel_decks (match_id, chain_id, arena, policy_version, lane, cards, sealed)
    VALUES (${deck.matchId}, ${deck.chainId}, ${deck.arena.toLowerCase()}, ${deck.policyVersion}, ${deck.lane},
            ${JSON.stringify(deck.cards)}::jsonb, ${deck.sealed})
    ON CONFLICT (match_id) DO NOTHING
  `;
}

export async function getDeck(matchId: string): Promise<SealedDeck | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<{ match_id: string; chain_id: number; arena: string; policy_version: number; lane: string; cards: string[]; sealed: string }[]>`
    SELECT match_id, chain_id, arena, policy_version, lane, cards, sealed FROM duel_decks WHERE match_id = ${matchId.toLowerCase()}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    matchId: row.match_id,
    chainId: row.chain_id,
    arena: row.arena,
    policyVersion: row.policy_version,
    lane: row.lane as SealedDeck["lane"],
    cards: row.cards,
    sealed: row.sealed,
  };
}

/**
 * Marks a deck opened. The row is kept rather than deleted: the cards are public on chain from this
 * moment, so there is nothing left to protect, and keeping it lets a later question about which lane
 * dealt a match be answered without replaying a log.
 */
export async function markDeckRevealed(matchId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`UPDATE duel_decks SET revealed_at = COALESCE(revealed_at, now()) WHERE match_id = ${matchId.toLowerCase()}`;
}

/** Decks committed but never opened — what an operator has to answer for after an outage. */
export async function listUnrevealedDecks(chainId: number, arena: string, limit = 50): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const rows = await db<{ match_id: string }[]>`
    SELECT match_id FROM duel_decks
    WHERE chain_id = ${chainId} AND arena = ${arena.toLowerCase()} AND revealed_at IS NULL
    ORDER BY created_at ASC LIMIT ${limit}
  `;
  return rows.map((r) => r.match_id);
}
