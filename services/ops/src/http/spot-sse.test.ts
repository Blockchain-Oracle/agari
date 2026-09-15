import { describe, expect, it } from "vitest";
import type { SpotFeed, SpotQuote } from "../prices/spot";
import { FRESH_MAX_AGE_SEC, latestBody, latestQuotes, type ArchiveReader } from "./spot-sse";

const NOW = 1_789_500_000;

/** A feed holding `quotes`, answering `latest` as the real one does: the newest quote per symbol inside `maxAgeSec`. */
function feedOf(quotes: readonly SpotQuote[]): SpotFeed {
  return {
    latest(symbol, maxAgeSec = 30) {
      const mine = quotes.filter((q) => q.symbol === symbol && NOW - q.publishTimeSec <= maxAgeSec).sort((a, b) => b.publishTimeSec - a.publishTimeSec);
      return mine[0] ?? null;
    },
    subscribe: () => () => undefined,
  };
}

const quote = (symbol: SpotQuote["symbol"], ageSec: number, source: SpotQuote["source"] = "redstone"): SpotQuote => ({
  symbol,
  priceE8: 35_700_000_000n,
  publishTimeSec: NOW - ageSec,
  source,
});

const noArchive: ArchiveReader = async () => new Map();

describe("/prices/latest never drops a symbol", () => {
  it("marks a quote inside the budget fresh and an older one aged, and keeps both", async () => {
    const body = await latestBody(feedOf([quote("TSLA", 10, "pyth"), quote("NVDA", 3 * 3600)]), { nowSec: NOW, archive: noArchive });
    expect(body.TSLA).toMatchObject({ source: "pyth", ageSec: 10, fresh: true, priceE8: "35700000000" });
    expect(body.NVDA).toMatchObject({ source: "redstone", ageSec: 3 * 3600, fresh: false });
    expect(body.NVDA?.publishTimeSec).toBe(NOW - 3 * 3600);
  });

  it("sits exactly on the budget as fresh, one second past it as aged", async () => {
    const body = await latestBody(feedOf([quote("TSLA", FRESH_MAX_AGE_SEC), quote("NVDA", FRESH_MAX_AGE_SEC + 1)]), { nowSec: NOW, archive: noArchive });
    expect(body.TSLA?.fresh).toBe(true);
    expect(body.NVDA?.fresh).toBe(false);
  });

  it("serves the newest print_archive row as `archive` when the feed holds nothing for a symbol", async () => {
    const asked: string[][] = [];
    const archive: ArchiveReader = async (symbols) => {
      asked.push([...symbols]);
      return new Map([["AAPL", { priceE8: "23000000000", boundarySec: NOW - 14 * 3600 }]]);
    };
    const rows = await latestQuotes(feedOf([quote("TSLA", 5)]), { nowSec: NOW, archive });
    const aapl = rows.find((r) => r.symbol === "AAPL");
    expect(aapl).toMatchObject({ source: "archive", priceE8: "23000000000", publishTimeSec: NOW - 14 * 3600, ageSec: 14 * 3600, fresh: false });
    // The live quote never goes to the archive; only the symbols the feed lacks are asked for.
    expect(asked[0]).not.toContain("TSLA");
    expect(asked[0]).toContain("AAPL");
  });

  it("omits a symbol only when neither the feed nor the archive knows it", async () => {
    const rows = await latestQuotes(feedOf([]), { nowSec: NOW, archive: noArchive });
    expect(rows).toEqual([]);
  });

  it("keeps the live rows when the archive read fails", async () => {
    const failing: ArchiveReader = () => Promise.reject(new Error("db down"));
    const rows = await latestQuotes(feedOf([quote("TSLA", 5)]), { nowSec: NOW, archive: failing });
    expect(rows.map((r) => r.symbol)).toEqual(["TSLA"]);
  });
});
