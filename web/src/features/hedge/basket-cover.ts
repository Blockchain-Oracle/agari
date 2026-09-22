/**
 * Covering a basket you hold (S19 A6, D-124): when a wallet holds two or more members of one basket and that basket's
 * 24/7 Window is trading, one Down bet on the basket covers them together. One held member is covered on its own
 * name's lane, never through a basket. Pure over the lane set and the holdings, so the live card, "Your baskets" and
 * the `/dev/hedge` fixtures pick the same way; the size is the ordinary `hedgeStakeBase` over the summed exposure.
 */
import { BASKET_SYMBOLS, BASKETS, isBasketCoverable, type TickerSymbol } from "@agari/core/market";
import type { LaneSet } from "@agari/core/types";
import { basketHolding, heldSymbols, tradingBasketWindow } from "@/features/baskets/basket-window";
import { tokenHorizon } from "./hedge-horizon";
import type { HedgePick } from "./hedge-target";
import type { HoldingView } from "./useHoldings";

const NO_SKIP: ReadonlySet<TickerSymbol> = new Set();
const bySharesDesc = (a: HoldingView, b: HoldingView) => (b.sharesE8 > a.sharesE8 ? 1 : b.sharesE8 < a.sharesE8 ? -1 : 0);

/**
 * A pick per basket the wallet can cover: `underlying` is the basket, `holdings` its held members (largest first),
 * `exposureUsdE6` their summed value (null when any is unpriced). `skip` carries the names the feed calls calm (plan §2),
 * which applies to a basket's index the same way. Registry order; `pickAllHedges` sorts the result by exposure.
 */
export function pickBasketHedges(holdings: readonly HoldingView[], laneSet: LaneSet | null, nowMs: number, skip: ReadonlySet<TickerSymbol> = NO_SKIP): HedgePick[] {
  const held = heldSymbols(holdings);
  const picks: HedgePick[] = [];
  for (const symbol of BASKET_SYMBOLS) {
    const basket = BASKETS[symbol];
    if (skip.has(symbol) || !isBasketCoverable(basket, held)) continue;
    const market = tradingBasketWindow(laneSet, symbol, nowMs);
    if (!market) continue;
    const own = basketHolding(basket, holdings);
    picks.push({
      underlying: symbol,
      holdings: [...own.holdings].sort(bySharesDesc),
      sharesE8: own.holdings.reduce((sum, h) => sum + h.sharesE8, 0n),
      exposureUsdE6: own.valueUsdE6,
      target: { market, kind: "down", horizon: tokenHorizon(Math.floor(nowMs / 1000)) },
    });
  }
  return picks;
}
