/**
 * The chain indexer's raw rows, projections and cursor (plan §4 indexer; venue-ops.md §9). Owned by S3 lane 3d.
 *
 * Unlike the social tables, everything here is derived from chain and rebuildable: truncate and replay from the deploy
 * slot. Amounts are exact integers: `NUMERIC` for u64 quantities, never floats. Two cash units appear, and each column
 * names its unit: `*_base` is collateral base units as the chain moved them (CompleteSet, Redeemed), and `*_ticklots`
 * is lots × price ticks, which becomes base units × the Series `cash_unit` (engine §1; 1 on the launch grid).
 *
 * Ordering: projections assume a Market's events apply in `seq` order. The writer detects an event older than one
 * already applied and rebuilds that Market's projections from `idx_events` in the same DB transaction.
 */
export const INDEX_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS idx_cursor (
  program        TEXT   PRIMARY KEY,
  -- The newest transaction such that every program transaction at or before it is indexed and finalized.
  slot           BIGINT NOT NULL,
  signature      TEXT   NOT NULL,
  updated_at_ms  BIGINT NOT NULL
);

-- Every transaction that mentions the program, failed ones included (no events), so a walk never refetches it.
CREATE TABLE IF NOT EXISTS idx_txs (
  signature       TEXT     PRIMARY KEY,
  slot            BIGINT   NOT NULL,
  block_time_sec  BIGINT,
  failed          BOOLEAN  NOT NULL,
  events          SMALLINT NOT NULL,
  commitment      TEXT     NOT NULL CHECK (commitment IN ('confirmed', 'finalized')),
  indexed_at_ms   BIGINT   NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_txs_slot_idx ON idx_txs (slot DESC);
CREATE INDEX IF NOT EXISTS idx_txs_confirmed_idx ON idx_txs (slot) WHERE commitment = 'confirmed';

-- Decoded emit_cpi! events, JSON-safe (bigints as decimal strings), keyed by position in the transaction.
CREATE TABLE IF NOT EXISTS idx_events (
  signature       TEXT     NOT NULL REFERENCES idx_txs (signature) ON DELETE CASCADE,
  outer_ix        SMALLINT NOT NULL,
  inner_ix        SMALLINT NOT NULL,
  slot            BIGINT   NOT NULL,
  block_time_sec  BIGINT,
  name            TEXT     NOT NULL,
  market          TEXT,
  seq             BIGINT,
  data            JSONB    NOT NULL,
  PRIMARY KEY (signature, outer_ix, inner_ix)
);
CREATE INDEX IF NOT EXISTS idx_events_market_seq_idx ON idx_events (market, seq);
CREATE INDEX IF NOT EXISTS idx_events_name_idx ON idx_events (name, slot DESC);
CREATE INDEX IF NOT EXISTS idx_events_owner_idx ON idx_events ((data->>'owner'), slot DESC) WHERE name IN ('CompleteSet', 'Redeemed', 'CreditWithdrawn');

-- Series facts read from the account the first time a Window of it is seen (SeriesRegistered is a log, D-019).
CREATE TABLE IF NOT EXISTS idx_series (
  series       TEXT     PRIMARY KEY,
  ticker       INTEGER  NOT NULL,
  symbol       TEXT,
  cadence_sec  INTEGER  NOT NULL,
  basis        SMALLINT NOT NULL,
  lot_base     NUMERIC  NOT NULL,
  tick_base    NUMERIC  NOT NULL,
  cash_unit    NUMERIC  NOT NULL
);

-- One row per Window (MarketId = the Market address). Created by WindowOpened; later events only update it.
CREATE TABLE IF NOT EXISTS idx_markets (
  market              TEXT     PRIMARY KEY,
  series              TEXT,
  symbol              TEXT,
  cadence_sec         INTEGER,
  basis               SMALLINT,
  market_index        BIGINT,
  trading_start_sec   BIGINT,
  lock_at_sec         BIGINT,
  expiry_sec          BIGINT,
  open_deadline_sec   BIGINT,
  close_deadline_sec  BIGINT,
  policy_version      SMALLINT,
  open_kind           SMALLINT,
  close_kind          SMALLINT,
  book                TEXT,
  ledger              TEXT,
  mvault              TEXT,
  generation          BIGINT,
  opened_signature    TEXT,
  opened_block_time_sec BIGINT,
  state               TEXT     NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'resolved', 'voided')),
  -- 0 Yes (Up), 1 No (Down), 2 Void.
  winner              SMALLINT,
  payout_yes          BIGINT,
  payout_no           BIGINT,
  void_reason         SMALLINT,
  single_source       BOOLEAN,
  resolved_ts_sec     BIGINT,
  resolved_signature  TEXT,
  backing_lots        NUMERIC  NOT NULL DEFAULT 0,
  volume_lots         NUMERIC  NOT NULL DEFAULT 0,
  volume_ticklots     NUMERIC  NOT NULL DEFAULT 0,
  trade_count         BIGINT   NOT NULL DEFAULT 0,
  last_price_ticks    SMALLINT,
  last_trade_sec      BIGINT,
  ledger_capacity     INTEGER,
  dependents          INTEGER  NOT NULL DEFAULT 0,
  book_released       BOOLEAN  NOT NULL DEFAULT false,
  ledger_closed       BOOLEAN  NOT NULL DEFAULT false,
  ledger_residue_base NUMERIC,
  closed              BOOLEAN  NOT NULL DEFAULT false,
  last_seq            BIGINT   NOT NULL DEFAULT 0,
  last_slot           BIGINT   NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_markets_series_idx ON idx_markets (series, market_index DESC);
CREATE INDEX IF NOT EXISTS idx_markets_expiry_idx ON idx_markets (expiry_sec DESC);
CREATE INDEX IF NOT EXISTS idx_markets_book_idx ON idx_markets (book);

-- Recorded prints, normalized to expo -8 on chain. which: 0 open, 1 close, 2 check open, 3 check close.
CREATE TABLE IF NOT EXISTS idx_prints (
  market           TEXT     NOT NULL,
  which            SMALLINT NOT NULL,
  source           SMALLINT NOT NULL,
  price            NUMERIC  NOT NULL,
  expo             INTEGER  NOT NULL,
  source_ts_sec    BIGINT   NOT NULL,
  signers          SMALLINT NOT NULL,
  copied           BOOLEAN  NOT NULL,
  recorded_ts_sec  BIGINT   NOT NULL,
  signature        TEXT     NOT NULL,
  PRIMARY KEY (market, which)
);

-- One row per placement (OrderExecuted). A resting remainder is tracked by its handle until filled, cancelled or expired.
CREATE TABLE IF NOT EXISTS idx_orders (
  signature        TEXT     NOT NULL,
  outer_ix         SMALLINT NOT NULL,
  inner_ix         SMALLINT NOT NULL,
  market           TEXT     NOT NULL,
  seq              BIGINT   NOT NULL,
  ts_sec           BIGINT   NOT NULL,
  owner            TEXT     NOT NULL,
  seat             INTEGER  NOT NULL,
  -- 0 BUY_YES, 1 SELL_YES, 2 BUY_NO, 3 SELL_NO; order_type 0 Normal, 1 FOK, 2 IOC, 3 PostOnly.
  kind             SMALLINT NOT NULL,
  order_type       SMALLINT NOT NULL,
  limit_price      SMALLINT NOT NULL,
  lots             NUMERIC  NOT NULL,
  expire_ts_sec    BIGINT   NOT NULL,
  client_id        NUMERIC  NOT NULL,
  filled_lots      NUMERIC  NOT NULL,
  cash_spent_base  NUMERIC  NOT NULL,
  cash_received_base NUMERIC NOT NULL,
  cancelled_lots   NUMERIC  NOT NULL,
  stop_reason      SMALLINT NOT NULL,
  rested_node      BIGINT,
  rested_seq       NUMERIC,
  rested_lots      NUMERIC  NOT NULL,
  remaining_lots   NUMERIC  NOT NULL,
  status           TEXT     NOT NULL CHECK (status IN ('done', 'open', 'filled', 'cancelled', 'expired')),
  -- RemoveReason when cancelled or expired: 0 Expired, 1 SelfMatch, 2 UserCancel, 3 CancelAll, 4 Sweep.
  removed_reason   SMALLINT,
  updated_seq      BIGINT   NOT NULL,
  PRIMARY KEY (signature, outer_ix, inner_ix)
);
CREATE INDEX IF NOT EXISTS idx_orders_handle_idx ON idx_orders (market, rested_node, rested_seq) WHERE rested_node IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_owner_idx ON idx_orders (owner, ts_sec DESC);

-- One row per FillRecord. price_ticks is the maker's price in YES terms; a NO leg's price is 1000 - price_ticks.
CREATE TABLE IF NOT EXISTS idx_fills (
  signature        TEXT     NOT NULL,
  outer_ix         SMALLINT NOT NULL,
  inner_ix         SMALLINT NOT NULL,
  fill_ix          SMALLINT NOT NULL,
  market           TEXT     NOT NULL,
  book             TEXT,
  seq              BIGINT   NOT NULL,
  slot             BIGINT   NOT NULL,
  ts_sec           BIGINT   NOT NULL,
  taker            TEXT     NOT NULL,
  taker_seat       INTEGER  NOT NULL,
  taker_kind       SMALLINT NOT NULL,
  maker            TEXT     NOT NULL,
  maker_seat       INTEGER  NOT NULL,
  maker_kind       SMALLINT NOT NULL,
  maker_node       BIGINT   NOT NULL,
  maker_order_seq  NUMERIC  NOT NULL,
  -- 0 DIRECT_YES, 1 DIRECT_NO, 2 MINT_PAIR, 3 BURN_PAIR.
  path             SMALLINT NOT NULL,
  price_ticks      SMALLINT NOT NULL,
  lots             NUMERIC  NOT NULL,
  maker_remaining  NUMERIC  NOT NULL,
  PRIMARY KEY (signature, outer_ix, inner_ix, fill_ix)
);
CREATE INDEX IF NOT EXISTS idx_fills_market_idx ON idx_fills (market, seq DESC, fill_ix DESC);
CREATE INDEX IF NOT EXISTS idx_fills_book_idx ON idx_fills (book, ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_fills_taker_idx ON idx_fills (taker, ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_fills_maker_idx ON idx_fills (maker, ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_fills_ts_idx ON idx_fills (ts_sec DESC);

-- What each wallet holds and moved in one Window: fills (both seats), complete sets, redemption.
CREATE TABLE IF NOT EXISTS idx_positions (
  market              TEXT    NOT NULL,
  owner               TEXT    NOT NULL,
  seat                INTEGER,
  yes_lots            NUMERIC NOT NULL DEFAULT 0,
  no_lots             NUMERIC NOT NULL DEFAULT 0,
  bought_yes_lots     NUMERIC NOT NULL DEFAULT 0,
  sold_yes_lots       NUMERIC NOT NULL DEFAULT 0,
  bought_no_lots      NUMERIC NOT NULL DEFAULT 0,
  sold_no_lots        NUMERIC NOT NULL DEFAULT 0,
  paid_ticklots       NUMERIC NOT NULL DEFAULT 0,
  received_ticklots   NUMERIC NOT NULL DEFAULT 0,
  minted_lots         NUMERIC NOT NULL DEFAULT 0,
  merged_lots         NUMERIC NOT NULL DEFAULT 0,
  set_paid_base       NUMERIC NOT NULL DEFAULT 0,
  set_received_base   NUMERIC NOT NULL DEFAULT 0,
  withdrawn_base      NUMERIC NOT NULL DEFAULT 0,
  redeemed_base       NUMERIC NOT NULL DEFAULT 0,
  payout_base         NUMERIC NOT NULL DEFAULT 0,
  bond_refund_base    NUMERIC NOT NULL DEFAULT 0,
  redeemed            BOOLEAN NOT NULL DEFAULT false,
  redeemed_by_crank   BOOLEAN NOT NULL DEFAULT false,
  fills               INTEGER NOT NULL DEFAULT 0,
  first_ts_sec        BIGINT,
  last_ts_sec         BIGINT,
  entry_signature     TEXT,
  last_signature      TEXT,
  PRIMARY KEY (market, owner)
);
CREATE INDEX IF NOT EXISTS idx_positions_owner_idx ON idx_positions (owner, last_ts_sec DESC);

-- 1-minute candles per Window from fills, YES-terms ticks.
CREATE TABLE IF NOT EXISTS idx_candles (
  market        TEXT     NOT NULL,
  bucket_sec    BIGINT   NOT NULL,
  open_ticks    SMALLINT NOT NULL,
  high_ticks    SMALLINT NOT NULL,
  low_ticks     SMALLINT NOT NULL,
  close_ticks   SMALLINT NOT NULL,
  volume_lots   NUMERIC  NOT NULL,
  trades        INTEGER  NOT NULL,
  PRIMARY KEY (market, bucket_sec)
);
`;

/** Every projection table, in the order a full rebuild truncates them. */
export const INDEX_TABLES = ["idx_candles", "idx_positions", "idx_fills", "idx_orders", "idx_prints", "idx_markets", "idx_series", "idx_events", "idx_txs", "idx_cursor"] as const;
