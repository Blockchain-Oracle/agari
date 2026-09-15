import { describe, expect, it } from "vitest";
import { emptyHaltState, observeHalts, stepHalts, type Observations } from "./decide";

const NOW = 1_789_156_800;
const live = (over: Partial<Observations> = {}): Observations => ({
  nowSec: NOW,
  inRegularHours: true,
  primary: { TSLA: "pyth", QQQ: "pyth", VOO: "pyth", NVDA: "redstone", AAPL: "redstone", MSFT: "redstone", META: "redstone", AMZN: "redstone", GOOGL: "redstone" },
  pyth: { TSLA: { price: 36_547_600n, conf: 6_068n, publishTimeSec: NOW }, QQQ: { price: 71_490_000n, conf: 9_000n, publishTimeSec: NOW }, VOO: { price: 70_249_748n, conf: 9_000n, publishTimeSec: NOW } },
  redstoneNewestSec: { NVDA: NOW - 5, AAPL: NOW - 5, MSFT: NOW - 5, META: NOW - 5, AMZN: NOW - 5, GOOGL: NOW - 5 },
  issuer: { TSLAx: false, NVDAx: false, SPYx: false, QQQx: false },
  quoteFailures: {},
  ...over,
});
const halted = (board: Map<string, string | null>) => Object.fromEntries([...board].filter(([, r]) => r !== null));

describe("halt-watch step", () => {
  it("halts nothing on healthy sources, and nothing for SPY, which has no signed source", () => {
    expect(halted(stepHalts(emptyHaltState(), observeHalts(live()), true))).toEqual({});
  });

  it("confirms a wide TSLA tick on the second pass, clears it at the close at once, and keeps a token halt overnight", () => {
    const state = emptyHaltState();
    const wide = live({ pyth: { ...live().pyth, TSLA: { price: 36_547_600n, conf: 182_739n, publishTimeSec: NOW } }, issuer: { NVDAx: true } });
    expect(halted(stepHalts(state, observeHalts(wide), true))).toEqual({ NVDAx: "issuer-halt" });
    expect(halted(stepHalts(state, observeHalts(wide), true))).toEqual({ TSLA: "pyth-wide", NVDAx: "issuer-halt" });
    const closed = { ...wide, inRegularHours: false };
    expect(halted(stepHalts(state, observeHalts(closed), false))).toEqual({ NVDAx: "issuer-halt" });
  });

  it("ages an unread RedStone feed into a stale halt and ignores TSLA's RedStone check", () => {
    const state = emptyHaltState();
    const stale = live({ redstoneNewestSec: { ...live().redstoneNewestSec, MSFT: NOW - 61 } });
    stepHalts(state, observeHalts(stale), true);
    expect(halted(stepHalts(state, observeHalts(stale), true))).toEqual({ MSFT: "redstone-stale" });
  });
});
