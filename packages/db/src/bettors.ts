import { getDb } from "./client";
import { socialGateReader } from "./idx/social-gate";
import { ensureSchema } from "./migrate";
import { storageKey } from "./keys";

export type BetRoute = "wallet" | "vault" | "leverage" | "private";

/** One canonical form at the write and the read (`keys.ts`): base58 exact, hex folded — see games.ts for the row this rule cost. */
const key = (value: string) => storageKey(value);

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

/** The registry over every Window of one ticker — a `$TSLA` Room's first gate step. */
export async function hasBetOnSymbol(chainId: number, symbol: string, wallet: string): Promise<boolean | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<{ one: number }[]>`
    SELECT 1 AS one FROM bettors b JOIN idx_markets m ON m.market = b.market_id
    WHERE b.wallet = ${key(wallet)} AND b.chain_id = ${chainId} AND m.symbol = ${symbol}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** The index's "ever bet" on one Window (`idx/social-gate.ts`), the gate's second step. `null` with no database. */
export async function hasIndexedBet(marketId: string, wallet: string): Promise<boolean | null> {
  const db = getDb();
  if (!db) return null;
  return socialGateReader(db).everBet(key(marketId), key(wallet));
}

/** The index's "ever bet" over every Window of one ticker. `null` with no database. */
export async function hasIndexedBetOnSymbol(symbol: string, wallet: string): Promise<boolean | null> {
  const db = getDb();
  if (!db) return null;
  return socialGateReader(db).everBetOnSymbol(symbol, key(wallet));
}

/** Whether the index holds a confirmed fill by `wallet` on this Window in transaction `txHash`. `null` with no database. */
export async function hasIndexedFill(txHash: string, marketId: string, wallet: string): Promise<boolean | null> {
  const db = getDb();
  if (!db) return null;
  return socialGateReader(db).fillBy(key(txHash), key(marketId), key(wallet));
}

/** Whether a fill on this Window could still be inside the indexer's lag. `null` with no database. */
export async function indexedWindowState(marketId: string, nowSec: number): Promise<"live" | "past" | "unknown" | null> {
  const db = getDb();
  if (!db) return null;
  return socialGateReader(db).windowState(key(marketId), nowSec);
}
