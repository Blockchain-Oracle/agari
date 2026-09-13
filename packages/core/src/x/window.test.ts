import { describe, expect, it } from "vitest";
import type { EventMarket } from "../types";
import { selectXWindow } from "./window";

const at = (minute: number, second = 0) => Date.UTC(2026, 8, 10, 8, minute, second);
const market = (over: Partial<EventMarket> & { onchainStatus?: number } = {}) => ({ asset: "BTC", intervalSec: 300, isUpDown: true,
  tradingStartSec: at(20) / 1000, expirySec: at(25) / 1000, openingPriceRaw: 1n,
  status: "Trading", voided: false, finalized: false, ...over }) as EventMarket;
const call = { asset: "BTC" as const, intervalSec: 300 };

describe("X Window matching", () => {
  it("admits the reported 5m and 15m timing cases under the 30-second buffer", () => {
    expect(selectXWindow([market()], call, at(23, 11)).ok).toBe(true);
    const fifteen = market({ intervalSec: 900, tradingStartSec: at(15) / 1000, expirySec: at(30) / 1000 });
    expect(selectXWindow([fifteen], { ...call, intervalSec: 900 }, at(25, 10)).ok).toBe(true);
  });
  it("identifies the exact cutoff, pending opening price and future start separately", () => {
    expect(selectXWindow([market()], call, at(24, 29)).ok).toBe(true);
    expect(selectXWindow([market()], call, at(24, 30))).toMatchObject({ ok: false, code: "window-entry-closed" });
    expect(selectXWindow([market({ openingPriceRaw: null })], call, at(21))).toMatchObject({ ok: false, code: "opening-price-pending" });
    expect(selectXWindow([market()], call, at(19))).toMatchObject({ ok: false, code: "window-not-started" });
    expect(selectXWindow([market({ onchainStatus: 2 })], call, at(21)).ok).toBe(false);
  });
  it("never silently substitutes a different asset, cadence or fixed-strike market", () => {
    for (const row of [market({ asset: "ETH" }), market({ intervalSec: 900 }), market({ isUpDown: false })]) {
      expect(selectXWindow([row], call, at(21))).toEqual({ ok: false, code: "no-window" });
    }
  });
});
