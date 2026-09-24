import type { EventMarket, LaneSet } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { tradingWindows } from "./trading-windows";

const NOW_SEC = 1_790_130_000;
const window = (asset: string, lane: EventMarket["lane"], startSec: number, expirySec: number) =>
  ({ asset, lane, intervalSec: 3_600, tradingStartSec: startSec, lockAtSec: expirySec, expirySec, status: "Open", voided: false }) as unknown as EventMarket;
const set = (markets: EventMarket[]) => ({ lanes: [{ markets }] }) as unknown as LaneSet;

describe("tradingWindows (09-24: strategies trade the 24/7 lanes too)", () => {
  it("keeps the 24/7 token lanes while the stock market is closed", () => {
    const openai = window("OPENAI", "token", NOW_SEC - 600, NOW_SEC + 3_000);
    const ailabs = window("AILABS", "token", NOW_SEC - 600, NOW_SEC + 3_000);
    expect(tradingWindows(set([openai, ailabs]), NOW_SEC * 1000)).toEqual([openai, ailabs]);
  });

  it("keeps a trading stock Window and drops one that has not opened", () => {
    const tsla = window("TSLA", "regular", NOW_SEC - 60, NOW_SEC + 240);
    const later = window("AAPL", "regular", NOW_SEC + 36_000, NOW_SEC + 36_300);
    expect(tradingWindows(set([tsla, later]), NOW_SEC * 1000)).toEqual([tsla]);
  });
});
