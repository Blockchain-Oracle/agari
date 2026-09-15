import { isTickerSymbol, TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@agari/core/market";
import { earningsWithin } from "@/lib/finnhub.server";
import type { SenseiRequest } from "./protocol";
import { EARNINGS_DAYS, type EarningsTurn } from "./turn-lines";

/**
 * How long a turn waits on the calendar. Warm, it answers from the client's 6 h cache at once; cold, the per-ticker
 * reads keep running past this and fill the cache for the next turn, so a slow Finnhub never holds the model call.
 */
const EARNINGS_WAIT_MS = 1_500;

/** Funds never report earnings, so they cost no call and add no line. */
const isStock = (symbol: TickerSymbol): boolean => TICKERS[symbol].kind === "stock";

/**
 * The stocks the reader is looking at or holding (S13 spec §1.1); every stock in the registry when there are none.
 * Each ticker is one Finnhub call per 6 h out of the web's 10 a minute, which is why funds are left out.
 */
export function earningsSymbols({ snapshot, positions }: Pick<SenseiRequest, "snapshot" | "positions">): TickerSymbol[] {
  const named = [...(snapshot?.markets ?? []).map((m) => m.asset), ...(positions ?? []).map((p) => p.asset)].filter(isTickerSymbol).filter(isStock);
  return named.length > 0 ? [...new Set(named)] : TICKER_SYMBOLS.filter(isStock);
}

/** This turn's earnings read: the next reports within 14 days, or `events: null` when unread in time. */
export async function earningsTurn(request: Pick<SenseiRequest, "snapshot" | "positions">): Promise<EarningsTurn> {
  const symbols = earningsSymbols(request);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), EARNINGS_WAIT_MS);
  });
  try {
    const events = await Promise.race([earningsWithin(symbols, EARNINGS_DAYS).catch(() => null), late]);
    return { events, symbols };
  } finally {
    clearTimeout(timer);
  }
}
