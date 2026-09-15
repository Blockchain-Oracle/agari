/**
 * The Room's index reads (social-assistant.md §1.2): "ever bet" and the fill that proves a registry write. Read
 * straight from the indexer's tables with no HTTP hop, and read-only — S13 never writes `idx_*`.
 *
 * "Ever bet" is an `idx_positions` row with a fill on either seat or minted lots. It stays true after the
 * wallet sells out and after the Window settles, which is what the Room owes a bettor: the thread outlives the
 * position. Every query leads with the owner, so `idx_positions_owner_idx` and the `idx_fills` PK carry them.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

/** Where a Window stands for the chain-seat step: "past" means the index already holds every fill it will get. */
export type IdxWindowState = "live" | "past" | "unknown";

/** Seconds after expiry before the index is trusted to hold every fill (the indexer lags ≈ 2 s; §1.2 allows 10). */
const INDEX_SETTLE_SEC = 60;

export function socialGateReader(sql: Sql) {
  return {
    /** Has `owner` ever filled or minted on this Window? */
    async everBet(market: string, owner: string): Promise<boolean> {
      const rows = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM idx_positions
        WHERE owner = ${owner} AND market = ${market} AND (fills > 0 OR minted_lots > 0)
        LIMIT 1`;
      return rows.length > 0;
    },

    /** Has `owner` ever filled or minted on any Window of this ticker? (Q-S13-3: no lookback limit.) */
    async everBetOnSymbol(symbol: string, owner: string): Promise<boolean> {
      const rows = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM idx_positions p JOIN idx_markets m ON m.market = p.market
        WHERE p.owner = ${owner} AND m.symbol = ${symbol} AND (p.fills > 0 OR p.minted_lots > 0)
        LIMIT 1`;
      return rows.length > 0;
    },

    /** A confirmed fill in transaction `signature` on this Window with `wallet` on either seat. */
    async fillBy(signature: string, market: string, wallet: string): Promise<boolean> {
      const rows = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM idx_fills f JOIN idx_txs t USING (signature)
        WHERE f.signature = ${signature} AND f.market = ${market} AND (f.taker = ${wallet} OR f.maker = ${wallet})
          AND NOT t.failed AND t.commitment IN ('confirmed', 'finalized')
        LIMIT 1`;
      return rows.length > 0;
    },

    /** Whether a fill on this Window could still be missing from the index. */
    async windowState(market: string, nowSec: number): Promise<IdxWindowState> {
      const [row] = await sql<{ state: string; expiry_sec: string | null }[]>`
        SELECT state, expiry_sec::text FROM idx_markets WHERE market = ${market}`;
      if (!row) return "unknown";
      const expired = row.expiry_sec !== null && Number(row.expiry_sec) + INDEX_SETTLE_SEC < nowSec;
      return row.state !== "open" || expired ? "past" : "live";
    },
  };
}

export type SocialGateReader = ReturnType<typeof socialGateReader>;
