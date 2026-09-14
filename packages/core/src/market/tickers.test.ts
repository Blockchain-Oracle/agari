import { describe, expect, it } from "vitest";
import { isHash32 } from "../types/primitives";
import { LAUNCH_TICKERS, RESERVED_SERIES_IDS, TICKER_SYMBOLS, TICKERS, TOKEN_LANE_TICKERS, tickerBySeriesId, tickerOfXStock } from "./tickers";

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
    expect(TICKER_SYMBOLS.every((symbol) => isHash32(TICKERS[symbol].pythFeedId))).toBe(true);
    expect(tickerOfXStock("SPYx").symbol).toBe("SPY");
  });
});
