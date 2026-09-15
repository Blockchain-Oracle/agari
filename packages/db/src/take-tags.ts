import type postgres from "postgres";

/** The most tickers one take is filed under (social-assistant.md §1.3). */
export const TAKE_TAGS_MAX = 4;

const SYMBOL_RE = /^[A-Z]{1,5}$/;

/**
 * Files a take under its tickers, inside the caller's transaction so the take and its tags land together.
 *
 * The caller has already matched the symbols against the ticker registry (`parseCashtags`); this layer only keeps
 * the shape honest: upper-case tickers, no repeats, at most four, in the order given.
 */
export async function insertTakeTags(tx: postgres.TransactionSql, takeId: string, symbols: readonly string[]): Promise<string[]> {
  const tags = [...new Set(symbols)].filter((symbol) => SYMBOL_RE.test(symbol)).slice(0, TAKE_TAGS_MAX);
  if (tags.length === 0) return [];
  await tx`
    INSERT INTO take_tags ${tx(tags.map((symbol) => ({ take_id: takeId, symbol })))}
    ON CONFLICT DO NOTHING
  `;
  return tags;
}
