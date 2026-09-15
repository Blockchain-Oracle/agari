/**
 * S13's social additions (social-assistant.md §2). Appended after `TAKES_SCHEMA_SQL` in `SCHEMA_SQL`, because
 * `take_tags` references `takes`. Idempotent `CREATE … IF NOT EXISTS` only, like every other social table.
 *
 * A take's cashtags: the registry tickers its caption names plus its Window's own asset, at most four
 * (`parseCashtags`). Written in the same transaction as the take, so a take is never listed under a ticker it
 * was not stored with. The primary key leads with the symbol because the one filtered read is "takes about
 * $TSLA"; the second index serves the tag list each take row carries.
 */
export const SOCIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS take_tags (
  take_id  BIGINT NOT NULL REFERENCES takes (id) ON DELETE CASCADE,
  -- A registry ticker, upper case as the registry writes it (TSLA, GOOGL).
  symbol   TEXT   NOT NULL,
  PRIMARY KEY (symbol, take_id)
);
CREATE INDEX IF NOT EXISTS take_tags_take_idx ON take_tags (take_id);
`;
