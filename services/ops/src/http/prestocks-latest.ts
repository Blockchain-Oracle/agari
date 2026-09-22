/**
 * `GET /prestocks/latest` (plan Step 1, stage G): per pre-IPO name, the two PreStocks prices the lane knows and the
 * premium of the trading price over the SPV mark, in integer basis points. Bigints travel as decimal strings. `fresh`
 * shares `/prices/latest`'s budget (D-086) so the two routes can never disagree about what "current" means.
 *
 * S19 (D-124): one row per basket too, keyed by the basket symbol and marked `kind: "basket"`: the index in points × 10⁸
 * from the newest read that priced every member, that read's member prices with each member's move from its frozen
 * base, and the index's own movement over the reads the feed still holds.
 */
import { BASKET_SYMBOLS, BASKETS, memberMoveBps, referencePremiumBps, type BasketSymbol, type PreIpoSymbol, type TickerSymbol } from "@agari/core/market";
import { basketIndexHistory, basketIndexLatest } from "../prices/basket-index";
import type { PreStocksSample, PreStocksSpotFeed } from "../prices/prestocks-spot";
import { FRESH_MAX_AGE_SEC } from "./spot-sse";

/** How a value moved over the samples the feed still holds (≈ 2 h): high to low and first to last, in bps. */
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

export interface BasketMemberWire {
  symbol: PreIpoSymbol;
  weightBps: number;
  /** The member's token price in the read the index came from. */
  tokenPriceE8: string;
  /** Integer bps the member has moved from its frozen base; null without a base. */
  moveBps: number | null;
}

export interface BasketWire {
  kind: "basket";
  /** Points × 10⁸ (`1e11` = 1,000 pts), never dollars. */
  indexE8: string;
  fetchedAtSec: number;
  ageSec: number;
  fresh: boolean;
  /** The index's own movement over the complete reads the feed holds; the calm rule applies to it like a name. */
  move: PreStocksMove | null;
  members: BasketMemberWire[];
}

export type PreStocksLatestBody = Record<string, PreStocksWire | BasketWire>;

/** One point of a movement series: a name's token price, or a basket's index. */
export interface MovePoint {
  valueE8: bigint;
  fetchedAtSec: number;
}

/** Movement over `points` (oldest first), bigint throughout; null until two points exist. */
export function movementOf(points: readonly MovePoint[]): PreStocksMove | null {
  const first = points[0];
  const last = points.at(-1);
  if (points.length < 2 || !first || !last || first.valueE8 <= 0n) return null;
  let high = first.valueE8;
  let low = first.valueE8;
  for (const p of points) {
    if (p.valueE8 > high) high = p.valueE8;
    if (p.valueE8 < low) low = p.valueE8;
  }
  if (low <= 0n) return null;
  return {
    windowSec: last.fetchedAtSec - first.fetchedAtSec,
    samples: points.length,
    rangeBps: Number(((high - low) * 10_000n) / low),
    changeBps: Number(((last.valueE8 - first.valueE8) * 10_000n) / first.valueE8),
  };
}

const tokenPoints = (samples: readonly PreStocksSample[]): MovePoint[] => samples.map((s) => ({ valueE8: s.tokenPriceE8, fetchedAtSec: s.fetchedAtSec }));

function basketRow(feed: PreStocksSpotFeed, symbol: BasketSymbol, nowSec: number): BasketWire | null {
  const basket = BASKETS[symbol];
  const snapshots = feed.snapshots();
  // The newest complete read, however old: the row says how old it is, the caller judges freshness.
  const latest = basketIndexLatest(snapshots, basket, nowSec, Number.MAX_SAFE_INTEGER);
  if (!latest) return null;
  const read = snapshots.find((s) => s.fetchedAtSec === latest.fetchedAtSec);
  if (!read) return null;
  const ageSec = Math.max(0, nowSec - latest.fetchedAtSec);
  return {
    kind: "basket",
    indexE8: latest.indexE8.toString(),
    fetchedAtSec: latest.fetchedAtSec,
    ageSec,
    fresh: ageSec <= FRESH_MAX_AGE_SEC,
    move: movementOf(basketIndexHistory(snapshots, basket).map((s) => ({ valueE8: s.indexE8, fetchedAtSec: s.fetchedAtSec }))),
    members: basket.members.map((m) => {
      const price = read.samples.get(m.symbol)!.tokenPriceE8;
      return { symbol: m.symbol, weightBps: m.weightBps, tokenPriceE8: price.toString(), moveBps: memberMoveBps(price, m.basePriceE8) };
    }),
  };
}

export function preStocksLatestBody(feed: PreStocksSpotFeed, nowSec = Math.floor(Date.now() / 1000)): PreStocksLatestBody {
  const out: PreStocksLatestBody = {};
  for (const symbol of feed.symbols() as readonly TickerSymbol[]) {
    const history = feed.history(symbol);
    const s = history.at(-1);
    if (!s) continue;
    const ageSec = Math.max(0, nowSec - s.fetchedAtSec);
    out[symbol] = {
      tokenPriceE8: s.tokenPriceE8.toString(),
      markPriceE8: s.markPriceE8.toString(),
      premiumBps: referencePremiumBps(s.tokenPriceE8, s.markPriceE8),
      fetchedAtSec: s.fetchedAtSec,
      ageSec,
      fresh: ageSec <= FRESH_MAX_AGE_SEC,
      move: movementOf(tokenPoints(history)),
    };
  }
  for (const symbol of BASKET_SYMBOLS) {
    const row = basketRow(feed, symbol, nowSec);
    if (row) out[symbol] = row;
  }
  return out;
}
