/**
 * Read-only index queries for S13's activity feeds (social-assistant.md §1.6): a wallet's inbox, the following feed and
 * a ticker hub. Nothing here writes `idx_*`. Integers leave Postgres as decimal strings; the web maps these rows to
 * `ActivityItem`s and derives each settlement's verdict with core's settlement rule.
 *
 * Two row shapes, one per source table:
 * - a fill row is one wallet's side of one `FillRecord` (`idx_fills`), with its own leg's notional already in base units;
 * - a settlement row is one wallet's seat on a terminal Window (`idx_positions` × `idx_markets`), carrying what was held
 *   at settlement, what it cost and returned, and whether and how the seat was redeemed.
 *
 * Drive-only Series (no registry symbol) never list, so they are nobody's activity, exactly as in wallet history.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

const LIMIT_MAX = 200;
/** A Window's pair pays 1,000 ticks (apply.ts `PAIR_TICKS`): a NO leg's price is 1,000 − the maker's YES price. */
const PAIR_TICKS = 1000;
const clamp = (limit: number | undefined, fallback = 50) => Math.max(1, Math.min(LIMIT_MAX, Math.floor(limit ?? fallback)));

export interface SocialFillRow {
  signature: string;
  outer_ix: number;
  inner_ix: number;
  fill_ix: number;
  market: string;
  wallet: string;
  /** The wallet's own order kind: 0 BUY_YES, 1 SELL_YES, 2 BUY_NO, 3 SELL_NO. */
  kind: number;
  symbol: string;
  cadence_sec: number | null;
  lots: string;
  /** The wallet's leg in collateral base units (cost of a buy, proceeds of a sell); null while the Series row is missing. */
  amount_base: string | null;
  ts_sec: string;
}

export interface SocialSettlementRow {
  market: string;
  owner: string;
  symbol: string;
  cadence_sec: number | null;
  state: "resolved" | "voided";
  /** 0 Yes (Up), 1 No (Down), 2 Void. */
  winner: number | null;
  resolved_ts_sec: string | null;
  expiry_sec: string | null;
  /** Lots of each outcome the seat held when trading stopped (fills plus complete sets), before any redemption. */
  held_yes_lots: string;
  held_no_lots: string;
  lot_base: string | null;
  /** Collateral paid for fills and mints, and received from sells and merges, in base units. */
  cost_base: string | null;
  proceeds_base: string | null;
  redeemed: boolean;
  redeemed_by_crank: boolean;
  payout_base: string;
  /** After a redemption, the redeem transaction and its block time (it is the seat's last event). */
  last_signature: string | null;
  last_ts_sec: string | null;
}

export interface SocialActivityQuery {
  /** Only activity at or after this unix second. */
  sinceSec?: number;
  limit?: number;
}

export function socialActivityReader(sql: Sql) {
  const fillCols = (seat: "taker" | "maker") => sql`
    f.signature, f.outer_ix, f.inner_ix, f.fill_ix, f.market, f.${sql(seat)} AS wallet, f.${sql(`${seat}_kind`)} AS kind, m.symbol, m.cadence_sec,
    f.lots::text AS lots,
    (CASE WHEN f.${sql(`${seat}_kind`)} IN (0, 1) THEN f.price_ticks * f.lots * s.cash_unit
          ELSE (${PAIR_TICKS} - f.price_ticks) * f.lots * s.cash_unit END)::text AS amount_base,
    f.ts_sec::text AS ts_sec`;

  const settlementCols = sql`
    p.market, p.owner, m.symbol, m.cadence_sec, m.state, m.winner, m.resolved_ts_sec::text, m.expiry_sec::text,
    GREATEST(p.bought_yes_lots - p.sold_yes_lots + p.minted_lots - p.merged_lots, 0)::text AS held_yes_lots,
    GREATEST(p.bought_no_lots - p.sold_no_lots + p.minted_lots - p.merged_lots, 0)::text AS held_no_lots,
    s.lot_base::text AS lot_base,
    (p.paid_ticklots * s.cash_unit + p.set_paid_base)::text AS cost_base,
    (p.received_ticklots * s.cash_unit + p.set_received_base)::text AS proceeds_base,
    p.redeemed, p.redeemed_by_crank, p.payout_base::text, p.last_signature, p.last_ts_sec::text`;

  const since = (column: postgres.PendingQuery<postgres.Row[]>, sinceSec: number | undefined) =>
    sinceSec === undefined ? sql`` : sql`AND ${column} >= ${sinceSec}`;

  return {
    /**
     * Fills of any of these wallets, newest first. Both seats by default (a maker's fill is still their activity);
     * `takerOnly` keeps just the calls — the side that crossed the book.
     */
    async walletFills(wallets: readonly string[], q: SocialActivityQuery & { takerOnly?: boolean } = {}): Promise<SocialFillRow[]> {
      if (wallets.length === 0) return [];
      const limit = clamp(q.limit);
      const list = wallets as string[];
      const seat = (side: "taker" | "maker") => sql`
        (SELECT ${fillCols(side)} FROM idx_fills f JOIN idx_markets m ON m.market = f.market LEFT JOIN idx_series s ON s.series = m.series
         WHERE f.${sql(side)} = ANY(${list}::text[]) AND m.symbol IS NOT NULL ${since(sql`f.ts_sec`, q.sinceSec)}
         ORDER BY f.ts_sec DESC, f.seq DESC, f.fill_ix DESC LIMIT ${limit})`;
      return sql<SocialFillRow[]>`
        SELECT * FROM (${seat("taker")} ${q.takerOnly ? sql`` : sql`UNION ALL ${seat("maker")}`}) a
        ORDER BY ts_sec::bigint DESC LIMIT ${limit}`;
    },

    /**
     * Seats of any of these wallets on terminal Windows, newest settlement first. A seat that never bet (a bond-only
     * seat: no fill and no mint) is left out. `sinceSec` matches a settlement or a crank redemption at or after it.
     */
    async walletSettlements(wallets: readonly string[], q: SocialActivityQuery = {}): Promise<SocialSettlementRow[]> {
      if (wallets.length === 0) return [];
      const window =
        q.sinceSec === undefined ? sql`` : sql`AND (m.resolved_ts_sec >= ${q.sinceSec} OR (p.redeemed_by_crank AND p.last_ts_sec >= ${q.sinceSec}))`;
      return sql<SocialSettlementRow[]>`
        SELECT ${settlementCols}
        FROM idx_positions p JOIN idx_markets m ON m.market = p.market LEFT JOIN idx_series s ON s.series = m.series
        WHERE p.owner = ANY(${wallets as string[]}::text[]) AND m.state <> 'open' AND m.symbol IS NOT NULL
          AND (p.fills > 0 OR p.minted_lots > 0) ${window}
        ORDER BY m.resolved_ts_sec DESC NULLS LAST LIMIT ${clamp(q.limit)}`;
    },

    /** The calls on one ticker's Windows (taker seats only, so the house's resting quotes are not everyone's call). */
    async tickerFills(symbol: string, q: SocialActivityQuery = {}): Promise<SocialFillRow[]> {
      return sql<SocialFillRow[]>`
        SELECT ${fillCols("taker")} FROM idx_fills f JOIN idx_markets m ON m.market = f.market LEFT JOIN idx_series s ON s.series = m.series
        WHERE m.symbol = ${symbol} ${since(sql`f.ts_sec`, q.sinceSec)}
        ORDER BY f.ts_sec DESC, f.seq DESC, f.fill_ix DESC LIMIT ${clamp(q.limit)}`;
    },

    /** Verdicts on one ticker's Windows for the wallets that called them (crossed the book at least once there). */
    async tickerSettlements(symbol: string, q: SocialActivityQuery = {}): Promise<SocialSettlementRow[]> {
      return sql<SocialSettlementRow[]>`
        SELECT ${settlementCols}
        FROM idx_markets m JOIN idx_positions p ON p.market = m.market LEFT JOIN idx_series s ON s.series = m.series
        WHERE m.symbol = ${symbol} AND m.state <> 'open' AND (p.fills > 0 OR p.minted_lots > 0)
          ${since(sql`m.resolved_ts_sec`, q.sinceSec)}
          AND EXISTS (SELECT 1 FROM idx_fills f WHERE f.market = p.market AND f.taker = p.owner)
        ORDER BY m.expiry_sec DESC LIMIT ${clamp(q.limit)}`;
    },
  };
}

export type SocialActivityReader = ReturnType<typeof socialActivityReader>;
