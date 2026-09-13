/**
 * The X rail's records. Chain truth is never stored here: a grant, a fill and a settlement live
 * on the EventVault; these rows remember who an X account routes to and what became of each
 * mention, so a receipt can be shown after the relay has moved on.
 *
 * Writers, one per table (AD-7): `x_links` → web (the bind/unlink routes), `x_receipts` and
 * `x_relay_state` → ops (the relay actor). Everything else reads.
 */
export const X_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS x_links (
  -- X's immutable numeric user id; the handle is display metadata and may change.
  author_id     TEXT        NOT NULL,
  handle        TEXT,
  -- Lowercased 0x address, verified from the wallet's signature over the link message.
  wallet        TEXT        NOT NULL,
  signature     TEXT        NOT NULL,
  issued_at_ms  BIGINT      NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  id            BIGSERIAL   PRIMARY KEY
);

-- The relay's one question: which wallet does this X account route to right now?
CREATE INDEX IF NOT EXISTS x_links_author_live_idx
  ON x_links (author_id) WHERE revoked_at IS NULL;
-- The card's one question: which X account routes to this wallet right now?
CREATE INDEX IF NOT EXISTS x_links_wallet_live_idx
  ON x_links (wallet) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS x_receipts (
  -- The tweet id, so a mention is executed at most once however often the poll sees it.
  mention_id    TEXT        PRIMARY KEY,
  author_id     TEXT        NOT NULL,
  handle        TEXT,
  wallet        TEXT,
  grant_id      TEXT,
  market_id     TEXT,
  side          TEXT        CHECK (side IN ('up', 'down')),
  -- Requested collateral base units; actual booked values are separate in details.
  stake_base    TEXT,
  details       JSONB,
  status        TEXT        NOT NULL CHECK (status IN ('refused', 'submitted', 'filled', 'nothing-filled', 'reverted', 'unknown')),
  reason        TEXT,
  tx_hash       TEXT,
  -- The mention's words, verbatim, so the receipt shows what was actually asked.
  instruction   TEXT        NOT NULL,
  at_ms         BIGINT      NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additive upgrade: old receipts keep NULL details; no historical fill amounts are invented.
ALTER TABLE x_receipts ADD COLUMN IF NOT EXISTS details JSONB;

CREATE INDEX IF NOT EXISTS x_receipts_wallet_idx
  ON x_receipts (wallet, at_ms DESC);

-- The relay's cursor (since_id) and any other durable scalar it keeps between runs.
CREATE TABLE IF NOT EXISTS x_relay_state (
  key         TEXT        PRIMARY KEY,
  value       TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
