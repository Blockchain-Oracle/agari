import { getDb } from "./client";
import { ensureSchema } from "./migrate";

export type BetRoute = "wallet" | "vault" | "leverage" | "private";

/** Lowercased at the write, so the read's `lower()` always meets it — see games.ts for the row this rule cost. */
const key = (value: string) => value.toLowerCase();

/** Records a wallet as a bettor on a Window. Idempotent: the first fill keeps the seat; later ones change nothing. */
export async function recordBettor(input: { chainId: number; marketId: string; wallet: string; txHash: string; route: BetRoute }): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await ensureSchema();
  await db`
    INSERT INTO bettors (chain_id, market_id, wallet, tx_hash, route)
    VALUES (${input.chainId}, ${key(input.marketId)}, ${key(input.wallet)}, ${key(input.txHash)}, ${input.route})
    ON CONFLICT (chain_id, market_id, wallet) DO NOTHING
  `;
  return true;
}

/** "Ever bet" — the reference's `bet_registry::has_bet`. `null` when no database is configured, never a false. */
export async function hasBet(chainId: number, marketId: string, wallet: string): Promise<boolean | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<{ one: number }[]>`
    SELECT 1 AS one FROM bettors
    WHERE chain_id = ${chainId} AND market_id = ${key(marketId)} AND wallet = ${key(wallet)}
    LIMIT 1
  `;
  return rows.length > 0;
}
