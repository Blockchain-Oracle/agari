import { parsePythSchedule, type PythSchedule } from "@agari/core/market";

const HERMES = "https://hermes.pyth.network";

/**
 * The Pyth market-hours schedule for one equity feed (Hermes `/v2/price_feeds` metadata, public, no key).
 * `symbol` is Pyth's, e.g. `Equity.US.TSLA/USD`. Throws when the feed or its schedule is missing or malformed.
 */
export async function fetchPythSchedule(symbol = "Equity.US.TSLA/USD"): Promise<PythSchedule> {
  const url = `${HERMES}/v2/price_feeds?query=${encodeURIComponent(symbol)}&asset_type=equity`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Hermes price_feeds HTTP ${res.status}`);
  const feeds = (await res.json()) as Array<{ attributes?: { symbol?: string; schedule?: string } }>;
  const schedule = feeds.find((f) => f.attributes?.symbol === symbol)?.attributes?.schedule;
  if (!schedule) throw new Error(`Hermes has no schedule for ${symbol}`);
  return parsePythSchedule(schedule);
}
