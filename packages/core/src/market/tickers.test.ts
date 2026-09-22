import { describe, expect, it } from "vitest";
import { isHash32 } from "../types/primitives";
import { BASKET_SYMBOLS, BASKETS } from "./baskets";
import { BASKET_TICKERS, isTokenOnlyKind, LAUNCH_TICKERS, PRE_IPO_SYMBOLS, PRE_IPO_TICKERS, RESERVED_SERIES_IDS, SHARE_TOKENS, TICKER_SYMBOLS, TICKERS, TOKEN_LANE_TICKERS, tickerBySeriesId, tickerOfXStock, tokenLaneAsset } from "./tickers";

describe("ticker registry", () => {
  it("gives every ticker a distinct, u16, never-reserved series id (it is part of every Series address)", () => {
    const ids = TICKER_SYMBOLS.map((symbol) => TICKERS[symbol].seriesId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(Number.isInteger(id) && id > 0 && id <= 0xffff).toBe(true);
      expect(RESERVED_SERIES_IDS[id]).toBeUndefined();
      expect(tickerBySeriesId(id)?.seriesId).toBe(id);
    }
  });

  it("keeps the plan's launch set and token lane, with well-formed feed ids", () => {
    expect(LAUNCH_TICKERS).toEqual(["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOGL", "QQQ", "VOO"]);
    expect(TOKEN_LANE_TICKERS).toEqual(["TSLA", "NVDA", "QQQ", "SPY"]);
    // Every exchange-listed ticker carries a well-formed Pyth feed id; a pre-IPO name has no listing, so it has none.
    const listed = TICKER_SYMBOLS.filter((symbol) => !isTokenOnlyKind(TICKERS[symbol].kind));
    expect(listed.every((symbol) => isHash32(TICKERS[symbol].pythFeedId))).toBe(true);
    expect(tickerOfXStock("SPYx").symbol).toBe("SPY");
  });

  it("models a pre-IPO name as having no exchange listing and a PreStocks token (D-100)", () => {
    expect(PRE_IPO_TICKERS).toEqual([...PRE_IPO_SYMBOLS]);
    for (const symbol of PRE_IPO_TICKERS) {
      const t = TICKERS[symbol];
      expect(t.kind).toBe("preIpo");
      // No exchange lists it, so nothing downstream may try to fetch an Alpaca calendar or a Pyth/RedStone print for it.
      expect(t.alpacaSymbol).toBeNull();
      expect(t.pythFeedId).toBeNull();
      expect(t.redstoneFeedId).toBeNull();
      expect(t.xstock).toBeNull();
      expect(t.launch).toBe(false);
      expect(t.preIpo?.symbol).toBe(symbol);
    }
    // Every exchange-listed ticker is the reverse: no PreStocks token, and an Alpaca symbol.
    for (const symbol of TICKER_SYMBOLS.filter((s) => !isTokenOnlyKind(TICKERS[s].kind))) {
      expect(TICKERS[symbol].preIpo).toBeNull();
      expect(TICKERS[symbol].basket).toBeNull();
      expect(TICKERS[symbol].alpacaSymbol).not.toBeNull();
    }
  });

  it("models a basket as a token-only ticker with no feed of its own and no PreStocks token (S19, D-124)", () => {
    expect(BASKET_TICKERS).toEqual([...BASKET_SYMBOLS]);
    for (const symbol of BASKET_SYMBOLS) {
      const t = TICKERS[symbol];
      expect(t.kind).toBe("basket");
      expect(t.seriesId).toBe(BASKETS[symbol].seriesId);
      expect(t.alpacaSymbol).toBeNull();
      expect(t.pythFeedId).toBeNull();
      expect(t.redstoneFeedId).toBeNull();
      expect(t.xstock).toBeNull();
      expect(t.ondo).toBeNull();
      expect(t.preIpo).toBeNull();
      expect(t.launch).toBe(false);
      expect(t.basket).toBe(symbol);
      expect(tokenLaneAsset(symbol)).toBe(symbol);
      // A basket has no wallet token of its own: the cover card reaches it through its held members.
      expect(SHARE_TOKENS.some((token) => token.underlying === symbol)).toBe(false);
    }
    for (const symbol of PRE_IPO_TICKERS) expect(TICKERS[symbol].basket).toBeNull();
  });

  // Impostor "TSLAx" mints exist (C:13 §5), so the holdings reader keys by mint alone: a repeated or mistyped mint would
  // credit a wallet for the wrong company's shares.
  it("keys every verified share token by a distinct mint of a registry ticker", () => {
    const mints = SHARE_TOKENS.map((token) => token.mint);
    expect(new Set(mints).size).toBe(mints.length);
    expect(new Set(SHARE_TOKENS.map((token) => token.symbol)).size).toBe(SHARE_TOKENS.length);
    for (const token of SHARE_TOKENS) {
      expect(TICKER_SYMBOLS).toContain(token.underlying);
      expect(token.symbol.startsWith(token.underlying)).toBe(true);
      expect(token.traded).toBe(token.issuer === "xstocks" && TOKEN_LANE_TICKERS.includes(token.underlying));
    }
  });
});

describe("parseLaneKey", () => {
  it("inverts laneKey for every basis", async () => {
    const { laneKey, parseLaneKey } = await import("./tickers");
    for (const symbol of TICKER_SYMBOLS.filter((s) => !isTokenOnlyKind(TICKERS[s].kind))) {
      for (const cadenceSec of [300, 900, 3600]) expect(parseLaneKey(laneKey(symbol, "regular", cadenceSec))).toEqual({ symbol, basis: "regular", cadenceSec });
      expect(parseLaneKey(laneKey(symbol, "gap", 604_800))).toEqual({ symbol, basis: "gap", cadenceSec: 604_800 });
    }
    // A pre-IPO name has only the 24/7 lane: its bare symbol parses as token, and its Regular/Gap keys name no lane (D-103).
    for (const symbol of [...PRE_IPO_TICKERS, ...BASKET_TICKERS]) {
      expect(parseLaneKey(laneKey(symbol, "token", 3600))).toEqual({ symbol, basis: "token", cadenceSec: 3600 });
      expect(laneKey(symbol, "regular", 300)).toBe(`#${symbol}-regular-300`);
      expect(parseLaneKey(laneKey(symbol, "regular", 300))).toBeNull();
      expect(parseLaneKey(laneKey(symbol, "gap", 604_800))).toBeNull();
      expect(parseLaneKey(`${symbol}-gap`)).toBeNull();
    }
    for (const symbol of TOKEN_LANE_TICKERS) expect(parseLaneKey(laneKey(symbol, "token", 300))).toEqual({ symbol, basis: "token", cadenceSec: 300 });
    expect(parseLaneKey("TSLAx-5m")).toEqual({ symbol: "TSLA", basis: "token", cadenceSec: 300 });
  });
  it("refuses keys that name no lane", async () => {
    const { parseLaneKey } = await import("./tickers");
    for (const key of ["", "TSLA", "TSLA-", "-5m", "COIN-5m", "TSLA-1h", "TSLA-0m", "AAPLx-5m", "tsla-5m"]) expect(parseLaneKey(key)).toBeNull();
  });
});

describe("valuation lanes (S20, D-125)", () => {
  it("models a valuation lane as its own token-only ticker on Pyth's index, with the pre-IPO name's own feed untouched", async () => {
    const { VALUATION_TICKERS, pythIndexFeedOf, laneKey, parseLaneKey } = await import("./tickers");
    const { PYTH_INDEX_FEEDS, VALUATION_SYMBOLS } = await import("./valuation");
    expect(VALUATION_TICKERS).toEqual([...VALUATION_SYMBOLS]);
    expect(VALUATION_TICKERS).toEqual(["OPENAIV", "ANTHROPICV"]);
    const trialFeeds = new Set(TICKER_SYMBOLS.flatMap((s) => (TICKERS[s].pythFeedId ? [TICKERS[s].pythFeedId] : [])));
    for (const symbol of VALUATION_TICKERS) {
      const t = TICKERS[symbol];
      expect(t.kind).toBe("valuation");
      expect(t.valuationOf).not.toBeNull();
      expect(t.seriesId).toBeGreaterThanOrEqual(930);
      // Its own Series id, because the Series PDA is (ticker, cadence, basis) and the token lane holds 910/3600/token.
      expect(t.seriesId).not.toBe(TICKERS[t.valuationOf!].seriesId);
      // The index is well-formed, is the same id the pre-IPO name carries, and is never a trial feed.
      expect(isHash32(t.pythIndexFeedId)).toBe(true);
      expect(t.pythIndexFeedId).toBe(PYTH_INDEX_FEEDS[t.valuationOf!]);
      expect(pythIndexFeedOf(symbol)).toBe(pythIndexFeedOf(t.valuationOf!));
      expect(trialFeeds.has(t.pythIndexFeedId!)).toBe(false);
      // Never `pythFeedId`: that field is what the trial feed list, the spot stream and `symbolOfPythFeed` key on.
      expect(t.pythFeedId).toBeNull();
      expect(t.alpacaSymbol).toBeNull();
      expect(t.redstoneFeedId).toBeNull();
      expect(t.xstock).toBeNull();
      expect(t.ondo).toBeNull();
      expect(t.preIpo).toBeNull();
      expect(t.basket).toBeNull();
      expect(t.launch).toBe(false);
      expect(t.monogram).toBe("V");
      expect(isTokenOnlyKind(t.kind)).toBe(true);
      expect(tokenLaneAsset(symbol)).toBe(symbol);
      expect(SHARE_TOKENS.some((token) => token.underlying === symbol)).toBe(false);
      // Its lane key is its own, and parses back as the 24/7 lane.
      expect(laneKey(symbol, "token", 3600)).toBe(`${symbol}-60m`);
      expect(parseLaneKey(`${symbol}-60m`)).toEqual({ symbol, basis: "token", cadenceSec: 3600 });
      expect(parseLaneKey(laneKey(symbol, "regular", 300))).toBeNull();
    }
    expect(parseLaneKey("OPENAIV-60m")).toEqual({ symbol: "OPENAIV", basis: "token", cadenceSec: 3600 });
    // The two indices are distinct from each other and from every trial feed.
    const indices = VALUATION_TICKERS.map((s) => TICKERS[s].pythIndexFeedId);
    expect(new Set(indices).size).toBe(indices.length);
    // A pre-IPO name carries its index (or null) and stays off Pyth's print path; nothing else carries one.
    for (const symbol of PRE_IPO_TICKERS) {
      expect(TICKERS[symbol].pythFeedId).toBeNull();
      expect(TICKERS[symbol].valuationOf).toBeNull();
      expect(TICKERS[symbol].pythIndexFeedId).toBe(PYTH_INDEX_FEEDS[symbol as keyof typeof PYTH_INDEX_FEEDS] ?? null);
    }
    expect(pythIndexFeedOf("OPENAI")).not.toBeNull();
    expect(pythIndexFeedOf("SPACEX")).toBeNull();
    for (const symbol of TICKER_SYMBOLS.filter((s) => !isTokenOnlyKind(TICKERS[s].kind) || TICKERS[s].basket)) {
      expect(TICKERS[symbol].pythIndexFeedId).toBeNull();
      expect(TICKERS[symbol].valuationOf).toBeNull();
    }
  });
});
