import { GAMES_SCHEMA_SQL } from "./schema-games";
import { STRATEGIES_SCHEMA_SQL } from "./schema-strategies";
import { X_SCHEMA_SQL } from "./schema-x";
import { X_DELIVERY_SCHEMA_SQL } from "./schema-x-delivery";
import { FAUCET_SCHEMA_SQL } from "./schema-faucet";

/**
 * The social store's schema. Social records only; chain truth is never stored here.
 *
 * Inline rather than a `.sql` file read at runtime: a bundler does not carry loose
 * files next to the module that reads them, so a schema loaded off disk works in
 * dev and fails on deploy — the worst place to find out. This travels with the code
 * that runs it.
 *
 * Idempotent, so applying it twice is safe and it can run on first use.
 *
 * What is deliberately NOT here: any claim about who may read or post. That gate is
 * the chain's — the route checks the caller holds a position before it will accept
 * a row — and a second copy of the rule in a constraint is how the two drift apart.
 */
export const ROOM_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS room_comments (
  id           BIGSERIAL PRIMARY KEY,
  -- The market this Room is about. Rooms are per-Window, as the reference's are: a
  -- comment about a 5m round is not a comment about the next one.
  market_id    TEXT        NOT NULL,
  -- Lowercased 0x address, verified from a signature before insert.
  author       TEXT        NOT NULL,
  body         TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 280),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The only read the Room makes: newest comments for one market.
CREATE INDEX IF NOT EXISTS room_comments_market_idx
  ON room_comments (market_id, created_at DESC);
`;

/**
 * A take: a public call on one Window, in the caller's words.
 *
 * The reference's take is two records — the words on Walrus and a `TakePosted` event
 * on-chain that carries author, market, side and the backing order id, "the
 * verifiable spine". Here one row carries both, and the spine is the wallet's own
 * signature over the call (`signature`, `issued_at_ms`), which the route verifies
 * before insert and which anyone can re-verify from the row.
 *
 * The Window's facts are snapshotted at post time (asset, cadence, expiry, the line)
 * because a take outlives its Window: the reel renders a call about a round that
 * closed an hour ago without a market lookup that may no longer answer.
 */
export const TAKES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS takes (
  id            BIGSERIAL PRIMARY KEY,
  market_id     TEXT        NOT NULL,
  -- Lowercased 0x address, verified from the signature before insert.
  author        TEXT        NOT NULL,
  side          TEXT        NOT NULL CHECK (side IN ('up', 'down')),
  caption       TEXT        NOT NULL CHECK (length(caption) <= 240),
  asset         TEXT        NOT NULL,
  interval_sec  INTEGER     NOT NULL,
  expiry_sec    INTEGER     NOT NULL,
  -- The opening print on the oracle's scale, as a decimal string; null when the
  -- call was posted before the print landed.
  line_raw      TEXT,
  -- Held a position on this Window at post time — a chain read the route makes,
  -- never a claim the client gets to assert.
  backed        BOOLEAN     NOT NULL,
  signature     TEXT        NOT NULL,
  issued_at_ms  BIGINT      NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The only read the reel makes: the newest takes, venue-wide.
CREATE INDEX IF NOT EXISTS takes_created_idx
  ON takes (created_at DESC);
`;

/**
 * Who has ever bet on a Window — the Room's gate, as the reference keeps it.
 *
 * Yosuku writes `bet_registry::record` into the bet transaction itself (`lib/sui/comments.ts` L77–84), so the
 * Room's "bettors only" is answered by a registry the bet wrote, one block later, forever. Reading the wallet's
 * open positions instead — what this app did — could never unlock the Room for a 2× boost (the reserve holds
 * the contracts), a private bet (the desk does) or a Trading Balance bet (the vault does), and lagged the
 * indexer for a plain one. This table is that registry: one row per (chain, Window, wallet), written by the
 * server after it has read the fill's own receipt, never on a client's say-so.
 */
export const BETTORS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS bettors (
  chain_id     INTEGER     NOT NULL,
  market_id    TEXT        NOT NULL,
  -- Lowercased 0x address, taken from the receipt the server read.
  wallet       TEXT        NOT NULL,
  -- The fill that earned the seat; the first one, kept.
  tx_hash      TEXT        NOT NULL,
  route        TEXT        NOT NULL CHECK (route IN ('wallet', 'vault', 'leverage', 'private')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, market_id, wallet)
);
`;

export const SCHEMA_SQL = `${BETTORS_SCHEMA_SQL}\n${ROOM_SCHEMA_SQL}\n${TAKES_SCHEMA_SQL}\n${STRATEGIES_SCHEMA_SQL}\n${X_SCHEMA_SQL}\n${X_DELIVERY_SCHEMA_SQL}\n${GAMES_SCHEMA_SQL}\n${FAUCET_SCHEMA_SQL}`;
