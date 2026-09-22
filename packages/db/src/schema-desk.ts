/**
 * The desk's off-chain records (S21, D-126, desk.md §6–§7). What the chain cannot say for a browser: every decision
 * record with its hash chain, the paper ledger of a practice desk, the owner's signed mandate versions and answers,
 * the runner's wakes and actions, hourly PreStocks marks for grading, and the desk's own event log.
 *
 * Writers (AD-7): the runner (`services/ops` desk-runner) owns records, actions, wakes, snapshots, deferrals, grades,
 * marks and the paper ledger; the web owns desks (create, mode, state, share), mandates, approvals' answers and
 * check-now requests. Money is integer base units as decimal TEXT, seconds as BIGINT, never a float or a timestamp.
 */
export const DESK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS desks (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The Desk PDA, base58 exact; null for a practice desk, which has no on-chain account.
  address               TEXT,
  owner                 TEXT        NOT NULL,
  operator              TEXT,
  cluster               TEXT        NOT NULL CHECK (cluster IN ('mainnet-beta', 'devnet', 'localnet')),
  mode                  TEXT        NOT NULL CHECK (mode IN ('practice', 'ask_first', 'on_its_own')),
  state                 TEXT        NOT NULL CHECK (state IN ('active', 'paused', 'stopped_by_loss', 'needs_attention', 'closed')),
  state_reason          TEXT,
  -- The program's counter and head as the database last saw them (zeros for a practice desk).
  chain_seq             BIGINT      NOT NULL DEFAULT 0,
  chain_head            TEXT        NOT NULL DEFAULT '0x0000000000000000000000000000000000000000000000000000000000000000',
  mandate_version       INTEGER     NOT NULL DEFAULT 0,
  -- The loss-limit baseline in USDC E6; null until the first fully priced valuation.
  drawdown_baseline_e6  TEXT,
  loss_breaches         INTEGER     NOT NULL DEFAULT 0,
  -- Hourly practice checks completed; six unlock Go live (desk.md §7).
  practice_checks       INTEGER     NOT NULL DEFAULT 0,
  record_opened_at_sec  BIGINT,
  share_public          BOOLEAN     NOT NULL DEFAULT false,
  created_at_sec        BIGINT      NOT NULL,
  updated_at_sec        BIGINT      NOT NULL,
  UNIQUE (cluster, owner)
);

CREATE INDEX IF NOT EXISTS desks_state_idx ON desks (cluster, state);

CREATE TABLE IF NOT EXISTS desk_mandates (
  id              BIGSERIAL   PRIMARY KEY,
  desk_id         UUID        NOT NULL REFERENCES desks (id),
  version         INTEGER     NOT NULL,
  -- The mandate's wire form (money as integer strings); its canonical hash is the fingerprint every record names.
  body            JSONB       NOT NULL,
  fingerprint     TEXT        NOT NULL,
  signer          TEXT        NOT NULL,
  signature       TEXT        NOT NULL,
  applied_at_sec  BIGINT      NOT NULL,
  UNIQUE (desk_id, version)
);

-- One row per (desk, slot, trigger): the runner claims a wake by inserting it, so two processes never check twice.
CREATE TABLE IF NOT EXISTS desk_wakes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  desk_id           UUID        NOT NULL REFERENCES desks (id),
  scheduled_for_sec BIGINT      NOT NULL,
  trigger           TEXT        NOT NULL CHECK (trigger IN ('hour', 'deposit', 'move', 'check_now', 'test_read', 'checkpoint', 'owner_request')),
  status            TEXT        NOT NULL CHECK (status IN ('requested', 'running', 'completed', 'failed', 'skipped')),
  started_at_sec    BIGINT,
  finished_at_sec   BIGINT,
  error             TEXT,
  -- A check-now request: who signed it (the web verifies the signature before the row exists).
  requested_by      TEXT,
  signature         TEXT,
  UNIQUE (desk_id, scheduled_for_sec, trigger)
);

CREATE INDEX IF NOT EXISTS desk_wakes_open_idx ON desk_wakes (desk_id, status, scheduled_for_sec DESC);

-- Upgrade a database that created desk_wakes before owner requests existed.
ALTER TABLE desk_wakes DROP CONSTRAINT IF EXISTS desk_wakes_trigger_check;
ALTER TABLE desk_wakes ADD CONSTRAINT desk_wakes_trigger_check CHECK (trigger IN ('hour', 'deposit', 'move', 'check_now', 'test_read', 'checkpoint', 'owner_request'));

-- The owner's signed standing orders the runner carries out through operator sells: sell everything, or close.
CREATE TABLE IF NOT EXISTS desk_owner_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  desk_id           UUID        NOT NULL REFERENCES desks (id),
  kind              TEXT        NOT NULL CHECK (kind IN ('sell_all', 'close')),
  signer            TEXT        NOT NULL,
  signature         TEXT        NOT NULL,
  requested_at_sec  BIGINT      NOT NULL,
  finished_at_sec   BIGINT,
  note              TEXT
);

CREATE INDEX IF NOT EXISTS desk_owner_requests_open_idx ON desk_owner_requests (desk_id) WHERE finished_at_sec IS NULL;

CREATE TABLE IF NOT EXISTS desk_records (
  desk_id         UUID        NOT NULL REFERENCES desks (id),
  seq             BIGINT      NOT NULL,
  prev_hash       TEXT        NOT NULL,
  record_hash     TEXT        NOT NULL UNIQUE,
  -- The hashed body (desk.v1), stored exactly as hashed; re-read and re-hashed before commit.
  body            JSONB       NOT NULL,
  -- Owner-only material (the owner's rules, the user message): never hashed, never public.
  private_notes   JSONB,
  outcome         TEXT        NOT NULL,
  summary         TEXT        NOT NULL,
  mode            TEXT        NOT NULL,
  symbol          TEXT,
  side            TEXT        CHECK (side IN ('buy', 'sell')),
  decided_at_sec  BIGINT      NOT NULL,
  wake_id         UUID,
  -- Set once an on-chain action carried this record's hash: the transaction and the program's seq after it.
  sealed_by_sig   TEXT,
  sealed_seq      BIGINT,
  PRIMARY KEY (desk_id, seq)
);

CREATE INDEX IF NOT EXISTS desk_records_desk_time_idx ON desk_records (desk_id, decided_at_sec DESC);
CREATE INDEX IF NOT EXISTS desk_records_symbol_idx ON desk_records (desk_id, symbol, decided_at_sec DESC);

CREATE TABLE IF NOT EXISTS desk_actions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  desk_id           UUID        NOT NULL REFERENCES desks (id),
  record_seq        BIGINT      NOT NULL,
  kind              TEXT        NOT NULL CHECK (kind IN ('buy', 'sell', 'checkpoint', 'post_ref')),
  state             TEXT        NOT NULL CHECK (state IN ('attempting', 'confirmed', 'reverted', 'refused', 'unknown')),
  signature         TEXT,
  chain_seq         BIGINT,
  symbol            TEXT,
  -- USDC E6 for a buy; raw tokens for a sell.
  amount_in         TEXT,
  expected_out      TEXT,
  min_out           TEXT,
  amount_out        TEXT,
  counted_e6        TEXT,
  deadline_sec      BIGINT,
  sent_at_sec       BIGINT      NOT NULL,
  confirmed_at_sec  BIGINT,
  error             TEXT
);

CREATE INDEX IF NOT EXISTS desk_actions_state_idx ON desk_actions (desk_id, state, sent_at_sec DESC);

CREATE TABLE IF NOT EXISTS desk_snapshots (
  id            BIGSERIAL   PRIMARY KEY,
  desk_id       UUID        NOT NULL REFERENCES desks (id),
  taken_at_sec  BIGINT      NOT NULL,
  total_e6      TEXT        NOT NULL,
  usdc_e6       TEXT        NOT NULL,
  -- [{symbol, mint, raw, priceE8, valueE6}] as strings.
  holdings      JSONB       NOT NULL,
  unpriced      JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS desk_snapshots_desk_idx ON desk_snapshots (desk_id, taken_at_sec DESC);

-- The practice ledger (desk.md §7): cash and raw positions by symbol, as integer strings.
CREATE TABLE IF NOT EXISTS desk_paper (
  desk_id         UUID        PRIMARY KEY REFERENCES desks (id),
  cash_e6         TEXT        NOT NULL,
  positions       JSONB       NOT NULL,
  updated_at_sec  BIGINT      NOT NULL
);

CREATE TABLE IF NOT EXISTS desk_deferrals (
  id              BIGSERIAL   PRIMARY KEY,
  desk_id         UUID        NOT NULL REFERENCES desks (id),
  symbol          TEXT        NOT NULL,
  kind            TEXT        NOT NULL CHECK (kind IN ('wait', 'would_have')),
  baseline        JSONB       NOT NULL,
  decision_seq    BIGINT      NOT NULL,
  revisit_at_sec  BIGINT      NOT NULL,
  ended_at_sec    BIGINT,
  ended_because   TEXT
);

CREATE INDEX IF NOT EXISTS desk_deferrals_open_idx ON desk_deferrals (desk_id, symbol) WHERE ended_at_sec IS NULL;

CREATE TABLE IF NOT EXISTS desk_approvals (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  desk_id          UUID        NOT NULL REFERENCES desks (id),
  record_seq       BIGINT      NOT NULL,
  symbol           TEXT        NOT NULL,
  side             TEXT        NOT NULL CHECK (side IN ('buy', 'sell')),
  asked_because    TEXT        NOT NULL CHECK (asked_because IN ('ask_first', 'large_action')),
  amount_in        TEXT        NOT NULL,
  expected_out     TEXT        NOT NULL,
  summary          TEXT        NOT NULL,
  asked_at_sec     BIGINT      NOT NULL,
  expires_at_sec   BIGINT      NOT NULL,
  answer           TEXT        CHECK (answer IN ('approved', 'declined', 'expired')),
  answered_at_sec  BIGINT,
  signer           TEXT,
  signature        TEXT,
  executed_seq     BIGINT,
  UNIQUE (desk_id, record_seq)
);

CREATE INDEX IF NOT EXISTS desk_approvals_open_idx ON desk_approvals (desk_id, asked_at_sec DESC);

CREATE TABLE IF NOT EXISTS desk_grades (
  desk_id            UUID        NOT NULL REFERENCES desks (id),
  record_seq         BIGINT      NOT NULL,
  graded_at_sec      BIGINT      NOT NULL,
  verdict            TEXT        NOT NULL CHECK (verdict IN ('better', 'worse', 'no_real_difference', 'ungradable')),
  difference_bps     INTEGER,
  price_then_e8      TEXT,
  price_later_e8     TEXT,
  chosen             TEXT        NOT NULL,
  alternative        TEXT        NOT NULL,
  why                TEXT        NOT NULL,
  counts_for_timing  BOOLEAN     NOT NULL,
  PRIMARY KEY (desk_id, record_seq)
);

-- Hourly PreStocks token and mark per name: the durable history grading and the hub sparkline read.
CREATE TABLE IF NOT EXISTS desk_price_marks (
  symbol    TEXT        NOT NULL,
  at_sec    BIGINT      NOT NULL,
  token_e8  TEXT        NOT NULL,
  mark_e8   TEXT        NOT NULL,
  PRIMARY KEY (symbol, at_sec)
);

CREATE TABLE IF NOT EXISTS desk_events (
  id       BIGSERIAL   PRIMARY KEY,
  desk_id  UUID        NOT NULL REFERENCES desks (id),
  kind     TEXT        NOT NULL,
  actor    TEXT        NOT NULL,
  detail   JSONB,
  at_sec   BIGINT      NOT NULL
);

CREATE INDEX IF NOT EXISTS desk_events_desk_idx ON desk_events (desk_id, at_sec DESC);
`;
