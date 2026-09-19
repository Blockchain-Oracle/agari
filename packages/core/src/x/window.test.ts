import { describe, expect, it } from "vitest";
import type { EventMarket } from "../types";
import { selectActionWindow, selectXWindow } from "./window";

const at = (minute: number, second = 0) => Date.UTC(2026, 8, 10, 8, minute, second);
const market = (over: Partial<EventMarket> & { onchainStatus?: number } = {}) => ({ asset: "TSLA", lane: "regular", intervalSec: 300,
  tradingStartSec: at(20) / 1000, lockAtSec: at(25) / 1000, expirySec: at(25) / 1000, openingPriceRaw: 1n,
  status: "Trading", voided: false, finalized: false, ...over }) as EventMarket;
const call = { asset: "TSLA" as const, intervalSec: 300 };

describe("X Window matching", () => {
  it("admits the reported 5m and 15m timing cases under the 30-second buffer", () => {
    expect(selectXWindow([market()], call, at(23, 11)).ok).toBe(true);
    const fifteen = market({ intervalSec: 900, tradingStartSec: at(15) / 1000, lockAtSec: at(30) / 1000, expirySec: at(30) / 1000 });
    expect(selectXWindow([fifteen], { ...call, intervalSec: 900 }, at(25, 10)).ok).toBe(true);
  });
  it("identifies the exact cutoff, pending opening price and future start separately", () => {
    expect(selectXWindow([market()], call, at(24, 29)).ok).toBe(true);
    expect(selectXWindow([market()], call, at(24, 30))).toMatchObject({ ok: false, code: "window-entry-closed" });
    expect(selectXWindow([market({ openingPriceRaw: null })], call, at(21))).toMatchObject({ ok: false, code: "opening-price-pending" });
    expect(selectXWindow([market()], call, at(19))).toMatchObject({ ok: false, code: "window-not-started" });
    expect(selectXWindow([market({ onchainStatus: 2 })], call, at(21)).ok).toBe(false);
  });
  it("never silently substitutes a different stock, cadence or the token lane", () => {
    for (const row of [market({ asset: "NVDA" }), market({ intervalSec: 900 }), market({ lane: "token" })]) {
      expect(selectXWindow([row], call, at(21))).toEqual({ ok: false, code: "no-window" });
    }
  });
});

/**
 * A Blink resolves a symbol to a lane on its own, with nobody reading the result before money moves, so the lane rule
 * (D-103) is checked here rather than trusted: a stock never resolves onto the 24/7 token lane, and a pre-IPO name —
 * which has no NYSE session to list against — resolves only there.
 */
describe("Blink Window matching", () => {
  const preIpo = { asset: "OPENAI" as const, intervalSec: 3_600 };
  const hourly = (over: Partial<EventMarket> = {}) => market({ intervalSec: 3_600, lockAtSec: at(50) / 1000, expirySec: at(50) / 1000, ...over });

  it("routes a pre-IPO name to the token lane and refuses it anywhere else", () => {
    expect(selectActionWindow([hourly({ asset: "OPENAI", lane: "token" })], preIpo, at(21)).ok).toBe(true);
    for (const lane of ["regular", "gap"] as const) {
      expect(selectActionWindow([hourly({ asset: "OPENAI", lane })], preIpo, at(21))).toEqual({ ok: false, code: "no-window" });
    }
  });

  it("never routes a stock onto the token lane, which prices the xStock and not the stock", () => {
    expect(selectActionWindow([hourly({ asset: "TSLA", lane: "token" })], { asset: "TSLA", intervalSec: 3_600 }, at(21)))
      .toEqual({ ok: false, code: "no-window" });
    expect(selectActionWindow([hourly({ asset: "TSLA", lane: "regular" })], { asset: "TSLA", intervalSec: 3_600 }, at(21)).ok).toBe(true);
  });

  it("reports why a shared link is closed rather than pretending no Window exists", () => {
    expect(selectActionWindow([hourly({ asset: "OPENAI", lane: "token" })], preIpo, at(10)))
      .toMatchObject({ ok: false, code: "window-not-started" });
    expect(selectActionWindow([hourly({ asset: "OPENAI", lane: "token", openingPriceRaw: null })], preIpo, at(21)))
      .toMatchObject({ ok: false, code: "opening-price-pending" });
  });
});
