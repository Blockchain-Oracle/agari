/**
 * `GET /prestocks/latest` (plan Step 1, stage G): per pre-IPO name, the two PreStocks prices the lane knows and the
 * premium of the trading price over the SPV mark, in integer basis points. Bigints travel as decimal strings. `fresh`
 * shares `/prices/latest`'s budget (D-086) so the two routes can never disagree about what "current" means.
 */
import type { TickerSymbol } from "@agari/core/market";
import type { PreStocksSample, PreStocksSpotFeed } from "../prices/prestocks-spot";
import { FRESH_MAX_AGE_SEC } from "./spot-sse";

/** How the token price moved over the samples the feed still holds (≈ 2 h): high to low and first to last, in bps. */
export interface PreStocksMove {
  windowSec: number;
  samples: number;
  rangeBps: number;
  changeBps: number;
}

export interface PreStocksWire {
  tokenPriceE8: string;
  markPriceE8: string;
  /** `(token − mark) × 10⁴ / mark`, truncated toward zero; null when the mark is zero. */
  premiumBps: number | null;
  fetchedAtSec: number;
  ageSec: number;
  fresh: boolean;
  /** Null with fewer than two samples. The web's "calm" judgement (plan §2) reads this, never a guess. */
  move: PreStocksMove | null;
}

/** Integer basis points of `token` over `mark`; bigint throughout, so a 15-significant-digit price never rounds through a float. */
export function premiumBps(tokenPriceE8: bigint, markPriceE8: bigint): number | null {
  if (markPriceE8 <= 0n) return null;
  return Number(((tokenPriceE8 - markPriceE8) * 10_000n) / markPriceE8);
}

/** Movement over `samples` (oldest first), bigint throughout; null until two samples exist. */
export function movementOf(samples: readonly PreStocksSample[]): PreStocksMove | null {
  const first = samples[0];
  const last = samples.at(-1);
  if (samples.length < 2 || !first || !last || first.tokenPriceE8 <= 0n) return null;
  let high = first.tokenPriceE8;
  let low = first.tokenPriceE8;
  for (const s of samples) {
    if (s.tokenPriceE8 > high) high = s.tokenPriceE8;
    if (s.tokenPriceE8 < low) low = s.tokenPriceE8;
  }
  if (low <= 0n) return null;
  return {
    windowSec: last.fetchedAtSec - first.fetchedAtSec,
    samples: samples.length,
    rangeBps: Number(((high - low) * 10_000n) / low),
    changeBps: Number(((last.tokenPriceE8 - first.tokenPriceE8) * 10_000n) / first.tokenPriceE8),
  };
}

export function preStocksLatestBody(feed: PreStocksSpotFeed, nowSec = Math.floor(Date.now() / 1000)): Record<string, PreStocksWire> {
  const out: Record<string, PreStocksWire> = {};
  for (const symbol of feed.symbols() as readonly TickerSymbol[]) {
    const history = feed.history(symbol);
    const s = history.at(-1);
    if (!s) continue;
    const ageSec = Math.max(0, nowSec - s.fetchedAtSec);
    out[symbol] = {
      tokenPriceE8: s.tokenPriceE8.toString(),
      markPriceE8: s.markPriceE8.toString(),
      premiumBps: premiumBps(s.tokenPriceE8, s.markPriceE8),
      fetchedAtSec: s.fetchedAtSec,
      ageSec,
      fresh: ageSec <= FRESH_MAX_AGE_SEC,
      move: movementOf(history),
    };
  }
  return out;
}
