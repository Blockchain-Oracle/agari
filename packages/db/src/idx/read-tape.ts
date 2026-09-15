/**
 * The venue-wide tape (proof-analytics.md §1, lane 5b): three paged scans that replace Masayume's per-pool fill pages and
 * per-wallet router pages. Each orders on a total key, so offset paging under a fixed upper bound never skips or repeats
 * a row. Integers stay decimal strings, as in `idx/read.ts`.
 */
import type postgres from "postgres";
import type { IdxRow } from "./read";

type Sql = postgres.Sql;

const LIMIT_MAX = 1_000;
const clamp = (limit: number | undefined) => Math.max(1, Math.min(LIMIT_MAX, Math.floor(limit ?? LIMIT_MAX)));
const skip = (offset: number | undefined) => Math.max(0, Math.floor(offset ?? 0));

export interface TapeMarketsQuery {
  /** Window start, unix seconds: Windows expiring at or after it, or resolving inside `[fromSec, toSec)`. */
  fromSec: number;
  toSec: number;
  /** Only Windows whose trading started at or after this second (their whole tape is in hand). */
  lookbackSec: number;
  limit?: number;
  offset?: number;
}

export interface TapeRangeQuery {
  /** `[sinceSec, untilSec)` on the fill's chain clock (`ts_sec`) or the action's block time. */
  sinceSec: number;
  untilSec: number;
  limit?: number;
  offset?: number;
}

/**
 * Windows in a board's scope with their Series grid (Masayume `scan.ts:40-45`); `MarketRow` shape without prints. A Window
 * expires after it starts trading, so `expiry_sec >= lookback` is implied; it is spelled out to range-scan the expiry index.
 */
export async function tapeMarkets(sql: Sql, q: TapeMarketsQuery): Promise<IdxRow[]> {
  return sql`
    SELECT m.market, m.series, m.symbol, m.cadence_sec, m.basis, m.market_index::text, m.trading_start_sec::text, m.lock_at_sec::text,
      m.expiry_sec::text, m.policy_version, m.book, m.ledger, m.state, m.winner, m.payout_yes::text, m.payout_no::text, m.void_reason,
      m.single_source, m.resolved_ts_sec::text, m.resolved_signature, m.backing_lots::text, m.volume_ticklots::text, m.trade_count::text,
      m.last_price_ticks, s.lot_base::text, s.tick_base::text, s.cash_unit::text, NULL AS prints
    FROM idx_markets m LEFT JOIN idx_series s ON s.series = m.series
    WHERE m.opened_signature IS NOT NULL AND m.expiry_sec >= ${q.lookbackSec} AND m.trading_start_sec >= ${q.lookbackSec}
      AND (m.expiry_sec >= ${q.fromSec} OR (m.resolved_ts_sec >= ${q.fromSec} AND m.resolved_ts_sec < ${q.toSec}))
    ORDER BY m.expiry_sec, m.market LIMIT ${clamp(q.limit)} OFFSET ${skip(q.offset)}`;
}

/** Every fill on the venue in a time range, oldest first (`idx_fills_ts_idx`). */
export async function tapeFills(sql: Sql, q: TapeRangeQuery): Promise<IdxRow[]> {
  return sql`
    SELECT f.signature, f.outer_ix, f.inner_ix, f.fill_ix, f.market, f.book, f.seq::text, f.slot::text, f.ts_sec::text, f.taker, f.taker_seat,
      f.taker_kind, f.maker, f.maker_seat, f.maker_kind, f.path, f.price_ticks, f.lots::text
    FROM idx_fills f
    WHERE f.ts_sec >= ${q.sinceSec} AND f.ts_sec < ${q.untilSec}
    ORDER BY f.ts_sec, f.seq, f.fill_ix, f.signature, f.outer_ix, f.inner_ix LIMIT ${clamp(q.limit)} OFFSET ${skip(q.offset)}`;
}

/** Complete-set mints and merges on the venue in a time range, oldest first, with their owner (`idx_events_name_idx`). */
export async function tapeActions(sql: Sql, q: TapeRangeQuery): Promise<IdxRow[]> {
  return sql`
    SELECT e.signature, e.name, e.market, e.seq::text, e.block_time_sec::text, e.data, e.data->>'owner' AS owner
    FROM idx_events e
    WHERE e.name = 'CompleteSet' AND e.block_time_sec >= ${q.sinceSec} AND e.block_time_sec < ${q.untilSec}
    ORDER BY e.block_time_sec, e.slot, e.signature, e.outer_ix, e.inner_ix LIMIT ${clamp(q.limit)} OFFSET ${skip(q.offset)}`;
}
