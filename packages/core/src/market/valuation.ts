import type { Hash32 } from "../types/primitives";
import type { Brand, PreIpoSymbol, Ticker } from "./tickers";

/**
 * Valuation lanes (S20, D-125): a pre-IPO name's Up/Down lane that settles on Pyth's `Equity.Index.<NAME>/USD`
 * valuation index instead of the PreStocks token price.
 *
 * Pyth has published 24/7 valuation indices for OpenAI and Anthropic since 2026-09-17 (expo −5 on Hermes). They price
 * the company's valuation, not the token: measured 2026-09-22 the OPENAI token sat about 11 % from its index, so the
 * token lane (`OPENAI-60m`, D-100) keeps printing the DEX price and a valuation lane is its own ticker. It has to be:
 * the Series PDA is `["series", ticker, cadence, basis]` and `910/3600/token` is the token lane's.
 *
 * Entitlement is per key. The venue's trial key answers 403 `pyth-indices` for both indices today (TSLA answers 200),
 * so every consumer of `pythIndexFeedId` is gated on ops' live probe (`pyth-entitlement`): the id never joins the
 * trial feed list, the spot stream, the halt watch or the archive pass while it is denied, because one 403 there would
 * latch `pythAuthFailed` and stop TSLA/QQQ/VOO settlement. A lane registers only after a probe answers 200.
 *
 * This module never imports `tickers.ts` at runtime (`tickers.ts` imports it); only types cross the other way.
 */

export const VALUATION_SYMBOLS = ["OPENAIV", "ANTHROPICV"] as const;
export type ValuationSymbol = (typeof VALUATION_SYMBOLS)[number];

/** Hermes `Equity.Index.<NAME>/USD` feed ids, read from Hermes on 2026-09-22; a name Pyth publishes no index for is absent. */
export const PYTH_INDEX_FEEDS: Readonly<Partial<Record<PreIpoSymbol, Hash32>>> = {
  OPENAI: "0x96d4bb23a3db78fdb72b3a03ce80ead686096f324319166534d9a27c0519c483",
  ANTHROPIC: "0x5da511a7c68b17a3bc94380cab4756bc83ab87f86307af10ea58467a64b6689d",
};

export interface Valuation {
  symbol: ValuationSymbol;
  /** Series ids 930–931: permanent, part of every Series address. */
  seriesId: number;
  name: string;
  /** The pre-IPO name whose valuation this lane prices. */
  of: PreIpoSymbol;
  brand: Brand;
}

export const VALUATIONS: Readonly<Record<ValuationSymbol, Valuation>> = {
  OPENAIV: { symbol: "OPENAIV", seriesId: 930, name: "OpenAI valuation (Pyth)", of: "OPENAI", brand: { slug: "openaiv", hex: "#10A37F" } },
  ANTHROPICV: { symbol: "ANTHROPICV", seriesId: 931, name: "Anthropic valuation (Pyth)", of: "ANTHROPIC", brand: { slug: "anthropicv", hex: "#8C4A2F" } },
};

/** Typed on the disc for every valuation lane: the company's own mark belongs to the token lane. */
export const VALUATION_MONOGRAM = "V";

/**
 * A valuation row: a registry ticker like a basket's, with every single-name field null, `valuationOf` naming the
 * company and `pythIndexFeedId` its index. `pythFeedId` stays null on purpose: `symbolOfPythFeed`, the trial feed list
 * and the spot stream all key on that field, and an index id there would put the feed on the trial key's path.
 */
export const VALUATION_ROWS: Readonly<Record<ValuationSymbol, Ticker>> = Object.fromEntries(
  VALUATION_SYMBOLS.map((symbol) => {
    const v = VALUATIONS[symbol];
    const row: Ticker = {
      symbol, seriesId: v.seriesId, name: v.name, kind: "valuation", alpacaSymbol: null,
      pythFeedId: null, redstoneFeedId: null, launch: false,
      xstock: null, ondo: null, preIpo: null, basket: null, pythIndexFeedId: PYTH_INDEX_FEEDS[v.of] ?? null, valuationOf: v.of,
      monogram: VALUATION_MONOGRAM, brand: v.brand,
    };
    return [symbol, row] as const;
  }),
) as Record<ValuationSymbol, Ticker>;
