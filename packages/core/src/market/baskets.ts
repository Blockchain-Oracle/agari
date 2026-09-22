import type { Brand, PreIpoSymbol } from "./tickers";

/**
 * Baskets (S19, D-124): a named group of PreStocks pre-IPO names with weights, bet on together.
 *
 * A basket is a registry ticker (`kind: "basket"`, series ids 920–924) whose 24/7 lane settles on an index the venue
 * computes from one same-fetch PreStocks read of every member and signs like any pre-IPO print. The index is
 * price-return, base 1,000 at the frozen base prices below, quoted in points (never dollars):
 *
 *   index_E8 = Σ_i floor(weightBps_i × price_i_E8 × BASE_E8 / (10,000 × basePrice_i_E8))
 *
 * Integer maths only (bigint). At the base prices every basket reads exactly `BASKET_INDEX_BASE_E8`; an equal-weight
 * pair that moves +10 % / −10 % reads exactly 1,000 again. Null whenever any member is missing, non-positive or has no
 * base yet, so a partial read can never be signed as a price.
 *
 * The base prices are frozen in code and mirrored into the Series record at registration. Changing a base is a new feed
 * version (`prestocks-basket-v2:…`) and a new policy version, never an edit: a settled Window must stay recomputable.
 * A re-issued member mint (the feed drops a row whose `contract_address` differs from the registry) makes every read
 * incomplete, so its baskets void until the registry and the base are re-cut.
 *
 * This module never imports `tickers.ts` at runtime (`tickers.ts` imports it); only types cross the other way.
 */

export const BASKET_SYMBOLS = ["AILABS", "FRONTIER", "PREDMKTS", "DEFSPACE", "PREALL"] as const;
export type BasketSymbol = (typeof BASKET_SYMBOLS)[number];

/** 1,000.00000000 points at expo −8: eleven orders of magnitude under `i64::MAX`, so a 100× move stays exact on-chain. */
export const BASKET_INDEX_BASE_E8 = 100_000_000_000n;
export const WEIGHT_DENOMINATOR_BPS = 10_000;
/** The attested feed id family for a basket lane: ASCII, zero-padded to 32 bytes, so a symbol may be at most 12 chars. */
export const BASKET_FEED_PREFIX = "prestocks-basket-v1:";
/** Two or more held members make a basket coverable (S19 A6): one member is covered by its own name's lane. */
export const BASKET_COVER_MIN_MEMBERS = 2;

export interface BasketMember {
  symbol: PreIpoSymbol;
  weightBps: number;
  /** The PreStocks token price the index is based at; null until the deploy script captured one. */
  basePriceE8: bigint | null;
}

export interface Basket {
  symbol: BasketSymbol;
  seriesId: number;
  name: string;
  /** One plain sentence for the hub and the ticket. */
  blurb: string;
  members: readonly BasketMember[];
  /** When the base prices were read (`fetchedAtSec` of that read); null until captured. */
  baseAtSec: number | null;
  monogram: string;
  brand: Brand;
}

const equal = (symbols: readonly PreIpoSymbol[], bases: Readonly<Record<string, bigint>>): BasketMember[] => {
  const each = Math.floor(WEIGHT_DENOMINATOR_BPS / symbols.length);
  const remainder = WEIGHT_DENOMINATOR_BPS - each * symbols.length;
  return symbols.map((symbol, i) => ({ symbol, weightBps: each + (i === 0 ? remainder : 0), basePriceE8: bases[symbol] ?? null }));
};

/**
 * Base prices: the PreStocks catalogue's `tokenPrice` per name, floored to E8, read at `BASE_AT_SEC` (2026-09-22
 * 17:06:43Z, `GET https://prestocks.com/api/prestocks`). `scripts/deploy/init-basket-series.ts --capture-base` prints a
 * fresh block in this shape; the registered bases are pinned by a snapshot test.
 */
const BASE_AT_SEC = 1_790_096_803;
const BASES: Readonly<Record<PreIpoSymbol, bigint>> = {
  OPENAI: 115_518_656_774n,
  ANTHROPIC: 104_642_768_409n,
  SPACEX: 11_771_844_301n,
  NEURALINK: 45_534_631_469n,
  ANDURIL: 15_066_033_108n,
  KALSHI: 86_951_379_103n,
  POLYMARKET: 14_424_495_088n,
  FIGUREAI: 17_564_014_445n,
};

export const BASKETS: Readonly<Record<BasketSymbol, Basket>> = {
  AILABS: {
    symbol: "AILABS", seriesId: 920, name: "AI Labs",
    blurb: "OpenAI and Anthropic, in equal measure.",
    members: equal(["OPENAI", "ANTHROPIC"], BASES), baseAtSec: BASE_AT_SEC,
    monogram: "AI", brand: { slug: "ailabs", hex: "#5B4BD6" },
  },
  FRONTIER: {
    symbol: "FRONTIER", seriesId: 921, name: "Frontier AI",
    blurb: "The two model labs, a humanoid-robot maker and a brain-interface company, in equal measure.",
    members: equal(["OPENAI", "ANTHROPIC", "FIGUREAI", "NEURALINK"], BASES), baseAtSec: BASE_AT_SEC,
    monogram: "FR", brand: { slug: "frontier", hex: "#0F766E" },
  },
  PREDMKTS: {
    symbol: "PREDMKTS", seriesId: 922, name: "Prediction Markets",
    blurb: "Kalshi and Polymarket, the two prediction-market companies, in equal measure.",
    members: equal(["KALSHI", "POLYMARKET"], BASES), baseAtSec: BASE_AT_SEC,
    monogram: "PM", brand: { slug: "predmkts", hex: "#B45309" },
  },
  DEFSPACE: {
    symbol: "DEFSPACE", seriesId: 923, name: "Defense & Space",
    blurb: "Anduril and SpaceX, in equal measure.",
    members: equal(["ANDURIL", "SPACEX"], BASES), baseAtSec: BASE_AT_SEC,
    monogram: "DS", brand: { slug: "defspace", hex: "#1E3A5F" },
  },
  PREALL: {
    symbol: "PREALL", seriesId: 924, name: "All PreStocks",
    blurb: "Every PreStocks name, in equal measure.",
    members: equal(["OPENAI", "ANTHROPIC", "SPACEX", "NEURALINK", "ANDURIL", "KALSHI", "POLYMARKET", "FIGUREAI"], BASES), baseAtSec: BASE_AT_SEC,
    monogram: "P8", brand: { slug: "preall", hex: "#4B5563" },
  },
};

export const isBasketSymbol = (v: unknown): v is BasketSymbol => typeof v === "string" && (BASKET_SYMBOLS as readonly string[]).includes(v);

export const basketOf = (symbol: string): Basket | null => (isBasketSymbol(symbol) ? BASKETS[symbol] : null);

/**
 * The basket's index at these member prices (E8 per UI token, as the PreStocks catalogue quotes them), or null when any
 * member is absent, non-positive, or has no base. Every price must come from ONE catalogue read: the caller owns that.
 */
export function basketIndexE8(members: readonly BasketMember[], pricesE8: ReadonlyMap<PreIpoSymbol, bigint>): bigint | null {
  let sum = 0n;
  for (const m of members) {
    const price = pricesE8.get(m.symbol);
    if (price === undefined || price <= 0n || m.basePriceE8 === null || m.basePriceE8 <= 0n) return null;
    sum += (BigInt(m.weightBps) * price * BASKET_INDEX_BASE_E8) / (BigInt(WEIGHT_DENOMINATOR_BPS) * m.basePriceE8);
  }
  return sum;
}

/** Integer basis points a member has moved from its base; null without a base or a positive price. */
export function memberMoveBps(priceE8: bigint, basePriceE8: bigint | null): number | null {
  if (basePriceE8 === null || basePriceE8 <= 0n || priceE8 <= 0n) return null;
  return Number(((priceE8 - basePriceE8) * 10_000n) / basePriceE8);
}

/** The members of `basket` a wallet holds, in basket order. */
export const basketMembersHeld = (basket: Basket, held: ReadonlySet<string>): PreIpoSymbol[] =>
  basket.members.filter((m) => held.has(m.symbol)).map((m) => m.symbol);

export const isBasketCoverable = (basket: Basket, held: ReadonlySet<string>): boolean =>
  basketMembersHeld(basket, held).length >= BASKET_COVER_MIN_MEMBERS;

/** Every basket that names `member`. */
export const basketsWithMember = (member: PreIpoSymbol): Basket[] =>
  BASKET_SYMBOLS.map((s) => BASKETS[s]).filter((b) => b.members.some((m) => m.symbol === member));
