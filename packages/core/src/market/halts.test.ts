import { describe, expect, it } from "vitest";
import { HALT_REASONS, type HaltReason } from "../types/session-lanes";
import { utc } from "./calendar.fixtures";
import { confirmHalt, haltLabel, primarySourceAt, pythHaltReason, redstoneHaltReason, stockHaltReason, tokenHaltReason, type HaltStreak, type SourceVersion } from "./halts";

/** The archived TSLA trial tick at 2026-09-11 20:00:00Z (price 36,547,600 e−5): 50 bps is conf 182,738. */
const T = 1_789_156_800;
const tick = (conf: bigint, publishTimeSec = T) => ({ price: 36_547_600n, conf, publishTimeSec });

describe("pyth halts", () => {
  it("halts one unit past the policy's 50 bps, exactly as the chain refuses the print", () => {
    expect(pythHaltReason(tick(6_068n), T)).toBeNull();
    expect(pythHaltReason(tick(182_738n), T)).toBeNull();
    expect(pythHaltReason(tick(182_739n), T)).toBe("pyth-wide");
    expect(pythHaltReason({ price: 0n, conf: 0n, publishTimeSec: T }, T)).toBe("pyth-wide");
  });

  it("calls a tick older than 15 s stale, and staleness wins over width", () => {
    expect(pythHaltReason(tick(6_068n), T + 15)).toBeNull();
    expect(pythHaltReason(tick(6_068n), T + 16)).toBe("pyth-stale");
    expect(pythHaltReason(tick(999_999n), T + 16)).toBe("pyth-stale");
    expect(pythHaltReason(null, T)).toBe("pyth-stale");
  });
});

describe("redstone and token halts", () => {
  it("halts a RedStone feed whose newest package is over 60 s old", () => {
    expect(redstoneHaltReason(T - 60, T)).toBeNull();
    expect(redstoneHaltReason(T - 61, T)).toBe("redstone-stale");
    expect(redstoneHaltReason(null, T)).toBe("redstone-stale");
  });

  it("takes the issuer flag first, then three failed quotes in a row", () => {
    expect(tokenHaltReason(true, 5)).toBe("issuer-halt");
    expect(tokenHaltReason(false, 2)).toBeNull();
    expect(tokenHaltReason(null, 3)).toBe("quote-unavailable");
  });
});

describe("which source a ticker halts on", () => {
  // price-sources.json TSLA and QQQ versions.
  const tsla: SourceVersion[] = [
    { validFromSec: utc("2026-09-11T00:00:00Z"), validUntilSec: utc("2026-09-25T20:00:00Z"), primary: "pyth" },
    { validFromSec: utc("2026-09-25T20:00:00Z"), validUntilSec: null, primary: "redstone" },
  ];
  const qqq = tsla.slice(0, 1);

  it("switches TSLA to RedStone at the 09-25 close and leaves QQQ with no source (paused, never halted)", () => {
    expect(primarySourceAt(tsla, utc("2026-09-25T19:59:59Z"))).toBe("pyth");
    expect(primarySourceAt(tsla, utc("2026-09-25T20:00:00Z"))).toBe("redstone");
    expect(primarySourceAt(qqq, utc("2026-09-25T20:00:00Z"))).toBe("pyth");
    expect(primarySourceAt(qqq, utc("2026-09-25T20:00:01Z"))).toBeNull();
    expect(primarySourceAt(tsla, utc("2026-09-10T23:59:59Z"))).toBeNull();
    expect(stockHaltReason(null, null, null, T)).toBeNull();
  });

  it("reads only the primary: TSLA on Pyth ignores a stale RedStone check", () => {
    expect(stockHaltReason("pyth", tick(6_068n), null, T)).toBeNull();
    expect(stockHaltReason("redstone", tick(6_068n), null, T)).toBe("redstone-stale");
  });
});

describe("confirming a halt", () => {
  const run = (observations: Array<HaltReason | null>) => {
    let state: { confirmed: HaltReason | null; streak: HaltStreak | null } = { confirmed: null, streak: null };
    return observations.map((observed) => (state = confirmHalt(state.confirmed, state.streak, observed)).confirmed);
  };

  it("needs two observations in a row to set or clear, and one for the issuer's flag", () => {
    expect(run(["pyth-wide", null, "pyth-wide", "pyth-wide", null, "pyth-wide", null, null])).toEqual([null, null, null, "pyth-wide", "pyth-wide", "pyth-wide", "pyth-wide", null]);
    expect(run(["pyth-wide", "pyth-stale", "pyth-stale"])).toEqual([null, null, "pyth-stale"]);
    expect(run(["issuer-halt", null, null])).toEqual(["issuer-halt", "issuer-halt", null]);
  });
});

it("says Trading halted only for a wide Pyth confidence or the issuer's flag (Q-S6-9)", () => {
  expect(Object.fromEntries(HALT_REASONS.map((r) => [r, haltLabel(r)]))).toEqual({
    "pyth-wide": "Trading halted",
    "pyth-stale": "Signed price stale",
    "redstone-stale": "Signed price stale",
    "issuer-halt": "Trading halted",
    "quote-unavailable": "Signed price stale",
  });
});
