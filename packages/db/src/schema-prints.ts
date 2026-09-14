/**
 * The raw signed-price archive (plan §4 price-relay; venue-ops.md §6.3). Owned by S3 lane 3b.
 *
 * Every boundary T of every covered ticker during a session is kept, whether or not a Window used it: the proof
 * replay (S5) re-verifies prints from these bytes, and RedStone's gateway only keeps about 24 hours of history.
 * Unlike the social tables, this *is* evidence about chain truth, so rows are append-only: never updated or deleted.
 */
export const PRINTS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS print_archive (
  source         TEXT     NOT NULL CHECK (source IN ('pyth', 'redstone', 'switchboard', 'attested')),
  -- pyth: lower-case feed id hex without 0x; redstone: the data feed id ("TSLA").
  feed           TEXT     NOT NULL,
  -- The boundary T, unix seconds.
  boundary_sec   BIGINT   NOT NULL,
  -- pyth: Hermes JSON for T ({ binary: { data: base64[] }, parsed: [...] }), exact response text;
  -- redstone: the gateway JSON array of this feed's packages at T, exact source text (values never re-serialized).
  payload        TEXT     NOT NULL,
  -- redstone: distinct signers at T; pyth: 1.
  signers        SMALLINT NOT NULL,
  -- The price normalized to expo -8 as a decimal integer string (redstone: the SDK median), for quick reads.
  price_e8       TEXT     NOT NULL,
  fetched_at_ms  BIGINT   NOT NULL,
  PRIMARY KEY (source, feed, boundary_sec)
);
-- When the row was stored (the gate measures T → archived, not T → fetched). Added after the first S3 rows existed.
ALTER TABLE print_archive ADD COLUMN IF NOT EXISTS archived_at_ms BIGINT NOT NULL DEFAULT (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
CREATE INDEX IF NOT EXISTS print_archive_boundary_idx ON print_archive (boundary_sec DESC);
`;
