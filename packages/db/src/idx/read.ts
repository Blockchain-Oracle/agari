/**
 * Read queries over the index for S4's `/api/index/*` (Masayume row shapes, mapped there). Integers stay decimal
 * strings; `*_ticklots` columns come back with the Series `cash_unit` so a caller can turn them into base units.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;
export type IdxRow = Record<string, unknown>;

const LIMIT_MAX = 1_000;
const clamp = (limit: number | undefined, fallback = 200) => Math.max(1, Math.min(LIMIT_MAX, Math.floor(limit ?? fallback)));

export interface IdxFillQuery {
  market?: string;
  /** A Window's Book (Masayume's `pool`); Books are recycled, so callers still filter on market. */
  book?: string;
  sinceSec?: number;
  limit?: number;
  offset?: number;
}

export interface IdxMarketQuery {
  market?: string;
  series?: string;
  symbol?: string;
  state?: "open" | "resolved" | "voided";
  /** Terminal Windows only (resolved or voided). */
  settled?: boolean;
  ids?: readonly string[];
  expiryFromSec?: number;
  expiryToSec?: number;
  limit?: number;
}

export function indexReader(sql: Sql) {
  const fillCols = sql`f.signature, f.outer_ix, f.inner_ix, f.fill_ix, f.market, f.book, f.seq::text, f.slot::text, f.ts_sec::text, f.taker, f.taker_seat,
    f.taker_kind, f.maker, f.maker_seat, f.maker_kind, f.path, f.price_ticks, f.lots::text, t.commitment`;
  return {
    /** A wallet's fills on either seat, newest first (Masayume `getUserFills`). */
    async walletFills(wallet: string, q: IdxFillQuery = {}): Promise<IdxRow[]> {
      return sql`
        SELECT ${fillCols} FROM idx_fills f JOIN idx_txs t USING (signature)
        WHERE (f.taker = ${wallet} OR f.maker = ${wallet})
          ${q.market ? sql`AND f.market = ${q.market}` : sql``} ${q.book ? sql`AND f.book = ${q.book}` : sql``}
          ${q.sinceSec !== undefined ? sql`AND f.ts_sec >= ${q.sinceSec}` : sql``}
        ORDER BY f.ts_sec DESC, f.seq DESC, f.fill_ix DESC LIMIT ${clamp(q.limit)} OFFSET ${Math.max(0, q.offset ?? 0)}`;
    },

    /** The tape of one Window or Book, newest first (Masayume `getFills(pool)`). */
    async fills(q: IdxFillQuery): Promise<IdxRow[]> {
      return sql`
        SELECT ${fillCols} FROM idx_fills f JOIN idx_txs t USING (signature)
        WHERE true ${q.market ? sql`AND f.market = ${q.market}` : sql``} ${q.book ? sql`AND f.book = ${q.book}` : sql``}
          ${q.sinceSec !== undefined ? sql`AND f.ts_sec >= ${q.sinceSec}` : sql``}
        ORDER BY f.ts_sec DESC, f.seq DESC, f.fill_ix DESC LIMIT ${clamp(q.limit)} OFFSET ${Math.max(0, q.offset ?? 0)}`;
    },

    /** Complete-set mints/merges and redemptions of a wallet (Masayume `getRouterActions`). */
    async walletActions(wallet: string, q: { limit?: number; offset?: number } = {}): Promise<IdxRow[]> {
      return sql`
        SELECT e.signature, e.name, e.market, e.seq::text, e.block_time_sec::text, e.data, t.commitment
        FROM idx_events e JOIN idx_txs t USING (signature)
        WHERE e.name IN ('CompleteSet', 'Redeemed', 'CreditWithdrawn') AND e.data->>'owner' = ${wallet}
        ORDER BY e.slot DESC, e.seq DESC LIMIT ${clamp(q.limit)} OFFSET ${Math.max(0, q.offset ?? 0)}`;
    },

    /** Windows with their Series facts and all four prints (Masayume `listLive/PastBinaryMarkets`, `getBinaryMarket`). */
    async markets(q: IdxMarketQuery = {}): Promise<IdxRow[]> {
      return sql`
        SELECT m.*, s.ticker, s.lot_base::text, s.tick_base::text, s.cash_unit::text,
          (SELECT json_object_agg(p.which, json_build_object('source', p.source, 'price', p.price::text, 'expo', p.expo, 'sourceTsSec', p.source_ts_sec,
             'signers', p.signers, 'copied', p.copied, 'signature', p.signature)) FROM idx_prints p WHERE p.market = m.market) AS prints
        FROM idx_markets m LEFT JOIN idx_series s ON s.series = m.series
        WHERE m.opened_signature IS NOT NULL
          ${q.market ? sql`AND m.market = ${q.market}` : sql``} ${q.series ? sql`AND m.series = ${q.series}` : sql``}
          ${q.symbol ? sql`AND m.symbol = ${q.symbol}` : sql``} ${q.state ? sql`AND m.state = ${q.state}` : sql``}
          ${q.settled ? sql`AND m.state <> 'open'` : sql``} ${q.ids ? sql`AND m.market = ANY(${q.ids as string[]}::text[])` : sql``}
          ${q.expiryFromSec !== undefined ? sql`AND m.expiry_sec >= ${q.expiryFromSec}` : sql``}
          ${q.expiryToSec !== undefined ? sql`AND m.expiry_sec <= ${q.expiryToSec}` : sql``}
        ORDER BY m.expiry_sec DESC LIMIT ${clamp(q.limit)}`;
    },

    /** Several Windows by id in one query (Masayume `getBinaryMarket` × n), without a limit past the ids asked for. */
    async marketsByIds(ids: readonly string[]): Promise<IdxRow[]> {
      if (ids.length === 0) return [];
      return this.markets({ ids, limit: ids.length });
    },

    /** Opening prints by Window (Masayume `getOpeningPrices`). */
    async openingPrints(markets: readonly string[]): Promise<IdxRow[]> {
      if (markets.length === 0) return [];
      return sql`SELECT market, source, price::text, expo, source_ts_sec::text, signers FROM idx_prints WHERE which = 0 AND market = ANY(${markets as string[]}::text[])`;
    },

    /** Recorded prints of a ticker over time: every open and close boundary once (Masayume `fetchPriceHistory`). */
    async printHistory(symbol: string, fromSec: number, toSec: number, limit?: number): Promise<IdxRow[]> {
      return sql`
        SELECT DISTINCT ON (p.source_ts_sec, p.source) p.source_ts_sec::text, p.source, p.price::text, p.expo, p.signers
        FROM idx_prints p JOIN idx_markets m ON m.market = p.market
        WHERE m.symbol = ${symbol} AND p.which IN (0, 1) AND p.source_ts_sec BETWEEN ${fromSec} AND ${toSec}
        ORDER BY p.source_ts_sec, p.source LIMIT ${clamp(limit, 500)}`;
    },

    /**
     * The signed 5-minute series a ticker's archive holds between two instants (D-086): one row per boundary, RedStone
     * preferred where both sources printed it. `keys` are the archive's own `(source, feed)` pairs for the ticker.
     */
    async printArchiveSeries(keys: readonly { source: string; feed: string }[], fromSec: number, toSec: number, limit?: number): Promise<IdxRow[]> {
      if (keys.length === 0) return [];
      const sources = [...new Set(keys.map((k) => k.source))];
      const feeds = [...new Set(keys.map((k) => k.feed))];
      return sql`
        SELECT DISTINCT ON (boundary_sec) boundary_sec::text, source, price_e8, signers FROM print_archive
        WHERE source = ANY(${sources}::text[]) AND feed = ANY(${feeds}::text[]) AND boundary_sec BETWEEN ${fromSec} AND ${toSec}
        ORDER BY boundary_sec, (source = 'redstone') DESC LIMIT ${clamp(limit, 500)}`;
    },

    /** A wallet's positions with the Window's state (Masayume `getPortfolio` / `getOpenPositionsWithPnL`). */
    async positions(owner: string, q: { unredeemedOnly?: boolean; limit?: number } = {}): Promise<IdxRow[]> {
      return sql`
        SELECT p.*, p.yes_lots::text AS yes_lots, p.no_lots::text AS no_lots, m.symbol, m.cadence_sec, m.expiry_sec, m.lock_at_sec, m.state, m.winner,
          m.payout_yes, m.payout_no, m.void_reason, s.cash_unit::text, s.lot_base::text, s.tick_base::text, m.last_price_ticks,
          m.series, m.ledger, m.trading_start_sec, m.resolved_ts_sec
        FROM idx_positions p JOIN idx_markets m ON m.market = p.market LEFT JOIN idx_series s ON s.series = m.series
        WHERE p.owner = ${owner} ${q.unredeemedOnly ? sql`AND NOT p.redeemed` : sql``}
        ORDER BY p.last_ts_sec DESC NULLS LAST LIMIT ${clamp(q.limit)}`;
    },

    async orders(q: { owner?: string; market?: string; openOnly?: boolean; limit?: number }): Promise<IdxRow[]> {
      return sql`
        SELECT * FROM idx_orders WHERE true ${q.owner ? sql`AND owner = ${q.owner}` : sql``} ${q.market ? sql`AND market = ${q.market}` : sql``}
          ${q.openOnly ? sql`AND status = 'open'` : sql``}
        ORDER BY ts_sec DESC, seq DESC LIMIT ${clamp(q.limit)}`;
    },

    async candles(market: string, fromSec: number, toSec: number): Promise<IdxRow[]> {
      return sql`SELECT bucket_sec::text, open_ticks, high_ticks, low_ticks, close_ticks, volume_lots::text, trades FROM idx_candles
        WHERE market = ${market} AND bucket_sec BETWEEN ${fromSec} AND ${toSec} ORDER BY bucket_sec`;
    },

    /** What the index holds for transactions at or below `slot`, for comparison with an independent chain walk. */
    async countsThrough(slot: number): Promise<IdxRow> {
      const [row] = await sql`
        SELECT (SELECT count(*) FROM idx_txs WHERE slot <= ${slot})::int AS txs, (SELECT count(*) FROM idx_txs WHERE slot <= ${slot} AND failed)::int AS failed_txs,
          (SELECT count(*) FROM idx_fills WHERE slot <= ${slot})::int AS fills,
          (SELECT count(*) FROM idx_markets m JOIN idx_txs t ON t.signature = m.opened_signature WHERE t.slot <= ${slot})::int AS windows_opened,
          (SELECT count(*) FROM idx_markets m JOIN idx_txs t ON t.signature = m.resolved_signature WHERE t.slot <= ${slot} AND m.state <> 'open')::int AS windows_resolved,
          (SELECT count(*) FROM (SELECT market, count(DISTINCT seq) AS n, max(seq) AS mx FROM idx_events WHERE market IS NOT NULL GROUP BY market) g WHERE g.n < g.mx)::int AS markets_with_gaps,
          (SELECT count(*) FROM (SELECT signature, outer_ix, inner_ix FROM idx_events GROUP BY 1, 2, 3 HAVING count(*) > 1) d)::int AS duplicate_events,
          (SELECT json_object_agg(name, n) FROM (SELECT name, count(*)::int AS n FROM idx_events WHERE slot <= ${slot} GROUP BY name) c) AS by_name,
          (SELECT max(block_time_sec) FROM idx_txs WHERE slot <= ${slot})::text AS last_block_time_sec,
          (SELECT max(slot) FROM idx_txs WHERE slot <= ${slot})::text AS last_slot`;
      return row!;
    },

    /** Counts and freshness for `/health`, the soak and `verify-index`. */
    async status(program: string): Promise<IdxRow> {
      const [row] = await sql`
        SELECT (SELECT count(*) FROM idx_txs)::int AS txs, (SELECT count(*) FROM idx_txs WHERE failed)::int AS failed_txs,
          (SELECT count(*) FROM idx_txs WHERE commitment = 'confirmed')::int AS confirmed_txs, (SELECT count(*) FROM idx_events)::int AS events,
          (SELECT count(*) FROM idx_fills)::int AS fills, (SELECT count(*) FROM idx_markets WHERE opened_signature IS NOT NULL)::int AS windows_opened,
          (SELECT count(*) FROM idx_markets WHERE state <> 'open')::int AS windows_resolved,
          (SELECT max(block_time_sec) FROM idx_txs)::text AS last_block_time_sec, (SELECT max(slot) FROM idx_txs)::text AS last_slot,
          (SELECT json_object_agg(name, n) FROM (SELECT name, count(*)::int AS n FROM idx_events GROUP BY name) c) AS by_name,
          (SELECT row_to_json(c) FROM (SELECT slot::text, signature, updated_at_ms::text FROM idx_cursor WHERE program = ${program}) c) AS cursor`;
      return row!;
    },
  };
}

export type IndexReader = ReturnType<typeof indexReader>;
