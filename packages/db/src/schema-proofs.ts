/**
 * `print_proofs` (proof-analytics.md §4, frozen at the S5 foundation; owned by lane 5d): one row per replayed signed
 * Pyth update, keyed by feed and boundary. The replay posts an archived blob to the devnet receiver and stores the
 * verified decode, so the proof page still shows it after the accounts are closed.
 */
export const PROOFS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS print_proofs (
  feed                   TEXT     NOT NULL,
  boundary_sec           BIGINT   NOT NULL,
  symbol                 TEXT     NOT NULL,
  source                 TEXT     NOT NULL,
  state                  TEXT     NOT NULL CHECK (state IN ('posting', 'verified', 'failed', 'closed')),
  receiver               TEXT,
  price_update           TEXT,
  verification           TEXT,
  price                  NUMERIC,
  conf                   NUMERIC,
  expo                   INT,
  publish_time_sec       BIGINT,
  prev_publish_time_sec  BIGINT,
  posted_slot            BIGINT,
  post_signatures        TEXT[],
  close_signature        TEXT,
  payer                  TEXT,
  error                  TEXT,
  posted_at_ms           BIGINT,
  closed_at_ms           BIGINT,
  PRIMARY KEY (feed, boundary_sec)
);
CREATE INDEX IF NOT EXISTS print_proofs_symbol_idx ON print_proofs (symbol, boundary_sec DESC);
`;
