/**
 * `/status` reads over the index (proof-analytics.md §1, §2.5; lane 5c): the print-source mix and record lag per lane,
 * the cross-checked print pairs, and the index head. Integers stay decimal strings; every predicate is index-backed
 * (`idx_markets_expiry_idx` narrows Windows, `idx_prints` is read by its primary key, `idx_txs_slot_idx` gives the head).
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

const CROSS_CHECK_ROWS_MAX = 2_000;

/** `status/prints` (plain types, so rows pass as `IdxRow`): one row per lane (`symbol`, `cadence_sec`), print slot `which` and `source`. */
export type PrintMixRow = {
  symbol: string | null;
  cadence_sec: number;
  /** 0 open, 1 close, 2 check open, 3 check close; null for the Windows of the lane that recorded no print at all. */
  which: number | null;
  /** 1 Pyth, 2 RedStone, 3 Switchboard, 4 Attested; null with `which`. */
  source: number | null;
  /** Windows holding this print (or, on the null row, holding none). */
  windows: number;
  /** Slowest `recorded_ts − source_ts` over prints the relay posted itself (copied opens excluded). */
  max_record_lag_sec: number | null;
  last_source_ts_sec: string | null;
  /** Windows of the whole lane voided for a missing print (repeated on each of the lane's rows). */
  missing_void: number;
};

/** `status/cross-checks`: a primary print and its check at the same boundary, both at expo −8. */
export type CrossCheckRow = {
  market: string;
  symbol: string | null;
  cadence_sec: number;
  which: number;
  primary_e8: string;
  check_e8: string;
  source_ts_sec: string;
};

export function statusReader(sql: Sql) {
  return {
    /** Over Windows with `trading_start_sec ≥ fromSec` (a Window that starts after `from` also expires after it). */
    async printMix(fromSec: number): Promise<PrintMixRow[]> {
      return sql<PrintMixRow[]>`
        WITH w AS (
          SELECT market, symbol, cadence_sec, state, void_reason FROM idx_markets
          WHERE opened_signature IS NOT NULL AND expiry_sec >= ${fromSec} AND trading_start_sec >= ${fromSec}
        ), v AS (
          SELECT symbol, cadence_sec, (count(*) FILTER (WHERE state = 'voided' AND void_reason = 1))::int AS missing_void
          FROM w GROUP BY symbol, cadence_sec
        )
        SELECT w.symbol, w.cadence_sec, p.which, p.source, count(DISTINCT w.market)::int AS windows,
          (max(p.recorded_ts_sec - p.source_ts_sec) FILTER (WHERE NOT p.copied))::int AS max_record_lag_sec,
          max(p.source_ts_sec)::text AS last_source_ts_sec, v.missing_void
        FROM w LEFT JOIN idx_prints p ON p.market = w.market
          JOIN v ON v.symbol IS NOT DISTINCT FROM w.symbol AND v.cadence_sec = w.cadence_sec
        GROUP BY w.symbol, w.cadence_sec, p.which, p.source, v.missing_void
        ORDER BY w.cadence_sec, w.symbol, p.which, p.source`;
    },

    /** Newest first, at most 2,000 pairs (a full session holds ≈ 220). */
    async crossChecks(fromSec: number): Promise<CrossCheckRow[]> {
      return sql<CrossCheckRow[]>`
        SELECT m.market, m.symbol, m.cadence_sec, a.which, a.price::text AS primary_e8, c.price::text AS check_e8, a.source_ts_sec::text
        FROM idx_markets m
          JOIN idx_prints a ON a.market = m.market AND a.which IN (0, 1)
          JOIN idx_prints c ON c.market = m.market AND c.which = a.which + 2 AND c.expo = a.expo
        WHERE m.opened_signature IS NOT NULL AND m.expiry_sec >= ${fromSec} AND m.trading_start_sec >= ${fromSec}
        ORDER BY m.expiry_sec DESC, m.market, a.which LIMIT ${CROSS_CHECK_ROWS_MAX}`;
    },

    /** The newest indexed transaction: its slot and block time. Both null on an empty index. */
    async head(): Promise<{ last_slot: string | null; last_block_time_sec: string | null }> {
      const [row] = await sql<Array<{ last_slot: string | null; last_block_time_sec: string | null }>>`
        SELECT slot::text AS last_slot, block_time_sec::text AS last_block_time_sec FROM idx_txs ORDER BY slot DESC LIMIT 1`;
      return row ?? { last_slot: null, last_block_time_sec: null };
    },
  };
}

export type StatusReader = ReturnType<typeof statusReader>;
