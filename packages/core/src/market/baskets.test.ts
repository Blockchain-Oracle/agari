import { describe, expect, it } from "vitest";
import {
  BASKET_FEED_PREFIX, BASKET_INDEX_BASE_E8, BASKET_SYMBOLS, BASKETS, WEIGHT_DENOMINATOR_BPS,
  basketIndexE8, basketMembersHeld, basketsWithMember, isBasketCoverable, memberMoveBps,
} from "./baskets";
import { referencePremiumBps } from "./premium";
import { PRE_IPO_SYMBOLS, TICKERS, TICKER_SYMBOLS } from "./tickers";
import type { PreIpoSymbol } from "./tickers";

const pricesAtBase = (symbol: (typeof BASKET_SYMBOLS)[number]) =>
  new Map<PreIpoSymbol, bigint>(BASKETS[symbol].members.map((m) => [m.symbol, m.basePriceE8 ?? 0n]));

describe("basket registry", () => {
  it("weights every basket to exactly 10,000 bps over pre-IPO members, on series ids no other row uses", () => {
    const others = new Set(TICKER_SYMBOLS.filter((s) => TICKERS[s].kind !== "basket").map((s) => TICKERS[s].seriesId));
    for (const symbol of BASKET_SYMBOLS) {
      const b = BASKETS[symbol];
      expect(b.symbol).toBe(symbol);
      expect(b.members.reduce((sum, m) => sum + m.weightBps, 0)).toBe(WEIGHT_DENOMINATOR_BPS);
      expect(new Set(b.members.map((m) => m.symbol)).size).toBe(b.members.length);
      for (const m of b.members) expect(PRE_IPO_SYMBOLS).toContain(m.symbol);
      expect(others.has(b.seriesId)).toBe(false);
      // The attested feed id is ASCII zero-padded to 32 bytes, so prefix + symbol must fit.
      expect(/^[A-Z0-9]{1,12}$/.test(symbol)).toBe(true); // ASCII, so one char is one byte below
      expect(`${BASKET_FEED_PREFIX}${symbol}`.length).toBeLessThanOrEqual(32);
    }
  });

  // The registered bases are part of every settled Window's arithmetic: a change here is a new feed version, never an edit.
  it("pins the frozen base prices of every basket", () => {
    const pinned: Record<string, string> = {};
    for (const symbol of BASKET_SYMBOLS) pinned[symbol] = `${BASKETS[symbol].baseAtSec}:${BASKETS[symbol].members.map((m) => `${m.symbol}=${m.basePriceE8}`).join(",")}`;
    expect(pinned).toMatchInlineSnapshot(`
      {
        "AILABS": "1790096803:OPENAI=115518656774,ANTHROPIC=104642768409",
        "DEFSPACE": "1790096803:ANDURIL=15066033108,SPACEX=11771844301",
        "FRONTIER": "1790096803:OPENAI=115518656774,ANTHROPIC=104642768409,FIGUREAI=17564014445,NEURALINK=45534631469",
        "PREALL": "1790096803:OPENAI=115518656774,ANTHROPIC=104642768409,SPACEX=11771844301,NEURALINK=45534631469,ANDURIL=15066033108,KALSHI=86951379103,POLYMARKET=14424495088,FIGUREAI=17564014445",
        "PREDMKTS": "1790096803:KALSHI=86951379103,POLYMARKET=14424495088",
      }
    `);
  });
});

describe("basketIndexE8", () => {
  it("reads exactly 1,000 at the base prices, for every basket", () => {
    for (const symbol of BASKET_SYMBOLS) expect(basketIndexE8(BASKETS[symbol].members, pricesAtBase(symbol))).toBe(BASKET_INDEX_BASE_E8);
  });

  it("is price-return: an equal-weight pair up 10 % and down 10 % reads 1,000 again, and a member up 20 % alone reads 1,100", () => {
    const members = [{ symbol: "OPENAI", weightBps: 5000, basePriceE8: 100n }, { symbol: "ANTHROPIC", weightBps: 5000, basePriceE8: 200n }] as const;
    const prices = new Map<PreIpoSymbol, bigint>([["OPENAI", 110n], ["ANTHROPIC", 180n]]);
    expect(basketIndexE8(members, prices)).toBe(BASKET_INDEX_BASE_E8);
    prices.set("ANTHROPIC", 200n);
    prices.set("OPENAI", 120n);
    expect(basketIndexE8(members, prices)).toBe(110_000_000_000n);
    // Each term floors to E8, so the real bases (15 significant digits) can lose one unit per member: never more.
    const real = BASKETS.AILABS.members;
    const [a, b] = real;
    if (!a?.basePriceE8 || !b?.basePriceE8) throw new Error("bases");
    const off = basketIndexE8(real, new Map<PreIpoSymbol, bigint>([[a.symbol, (a.basePriceE8 * 11n) / 10n], [b.symbol, (b.basePriceE8 * 9n) / 10n]]));
    expect(off !== null && BASKET_INDEX_BASE_E8 - off <= BigInt(real.length)).toBe(true);
  });

  it("is null when any member is missing, non-positive or has no base", () => {
    const members = BASKETS.PREDMKTS.members;
    const full = pricesAtBase("PREDMKTS");
    const missing = new Map(full);
    missing.delete("POLYMARKET");
    expect(basketIndexE8(members, missing)).toBeNull();
    const zero = new Map(full);
    zero.set("KALSHI", 0n);
    expect(basketIndexE8(members, zero)).toBeNull();
    expect(basketIndexE8([{ symbol: "KALSHI", weightBps: 10_000, basePriceE8: null }], full)).toBeNull();
  });

  it("never rounds through a float", () => {
    const members = BASKETS.PREALL.members;
    const prices = new Map<PreIpoSymbol, bigint>(members.map((m) => [m.symbol, (m.basePriceE8 ?? 0n) + 1n]));
    const index = basketIndexE8(members, prices);
    expect(typeof index).toBe("bigint");
    expect(index !== null && index > BASKET_INDEX_BASE_E8).toBe(true);
  });
});

describe("held members and moves", () => {
  it("covers a basket only with two or more held members, and finds every basket a member is in", () => {
    const held = new Set(["OPENAI", "TSLA"]);
    expect(basketMembersHeld(BASKETS.AILABS, held)).toEqual(["OPENAI"]);
    expect(isBasketCoverable(BASKETS.AILABS, held)).toBe(false);
    held.add("ANTHROPIC");
    expect(isBasketCoverable(BASKETS.AILABS, held)).toBe(true);
    expect(basketsWithMember("KALSHI").map((b) => b.symbol)).toEqual(["PREDMKTS", "PREALL"]);
  });

  it("measures a member's move and a token's premium in integer bps", () => {
    expect(memberMoveBps(110n, 100n)).toBe(1000);
    expect(memberMoveBps(90n, 100n)).toBe(-1000);
    expect(memberMoveBps(90n, null)).toBeNull();
    expect(referencePremiumBps(115_518_656_774n, 100_391_638_370n)).toBe(1506);
    expect(referencePremiumBps(1n, 0n)).toBeNull();
  });
});
