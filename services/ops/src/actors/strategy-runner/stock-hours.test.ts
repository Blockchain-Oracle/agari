import type { EventMarket, LaneSet } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { tradingStockWindows } from "./stock-hours";

const NOW_SEC = 1_790_130_000;
const window = (asset: string, lane: EventMarket["lane"], startSec: number, expirySec: number) =>
  ({ asset, lane, intervalSec: 3_600, tradingStartSec: startSec, lockAtSec: expirySec, expirySec, status: "Open", voided: false }) as unknown as EventMarket;
const set = (markets: EventMarket[]) => ({ lanes: [{ markets }] }) as unknown as LaneSet;

describe("tradingStockWindows (S24: strategies trade stock Windows; the runner rests without one)", () => {
  it("leaves out the 24/7 token lanes", () => {
    const live = set([window("OPENAI", "token", NOW_SEC - 600, NOW_SEC + 3_000), window("AILABS", "token", NOW_SEC - 600, NOW_SEC + 3_000)]);
    expect(tradingStockWindows(live, NOW_SEC * 1000)).toEqual([]);
  });

  it("keeps a trading stock Window and drops one that has not opened", () => {
    const tsla = window("TSLA", "regular", NOW_SEC - 60, NOW_SEC + 240);
    const later = window("AAPL", "regular", NOW_SEC + 36_000, NOW_SEC + 36_300);
    expect(tradingStockWindows(set([tsla, later, window("OPENAI", "token", NOW_SEC - 600, NOW_SEC + 3_000)]), NOW_SEC * 1000)).toEqual([tsla]);
  });
});
