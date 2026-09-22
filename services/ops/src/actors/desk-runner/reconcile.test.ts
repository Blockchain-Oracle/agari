/**
 * The money arithmetic the runner adds on top of core: outside money against the desk's own fills, the baseline that
 * scales rather than adds, the half-hour mean's sample rule, and the move that wakes a desk.
 */
import { describe, expect, it } from "vitest";
import type { PreStocksSample } from "../../prices/prestocks-spot";
import { findOutsideChanges, netFlowE6, scaledBaseline } from "./reconcile";
import { heldMoveBps, meanPriceE8 } from "./value";

const E6 = 1_000_000n;

describe("outside changes", () => {
  it("nets the desk's own fills out and leaves what the owner moved", () => {
    const previous = { cashE6: 1000n * E6, positions: { OPENAI: 10n * 10n ** 9n } };
    const fills = [{ kind: "buy", symbol: "OPENAI", amountIn: 50n * E6, amountOut: 2n * 10n ** 9n }];
    // After the buy the desk should hold 950 cash and 12 OPENAI; the owner then added 100 cash and withdrew 2 OPENAI.
    const current = { cashE6: 1050n * E6, positions: { OPENAI: 10n * 10n ** 9n } };
    const price = { OPENAI: (raw: bigint) => (raw * 25n * E6) / 10n ** 9n };
    const changes = findOutsideChanges(previous, fills, current, price);
    expect(changes).toEqual([
      { asset: "USDC", delta: 100n * E6, valueE6: 100n * E6, priced: true },
      { asset: "OPENAI", delta: -2n * 10n ** 9n, valueE6: -50n * E6, priced: true },
    ]);
    expect(netFlowE6(changes)).toBe(50n * E6);
  });
  it("marks a change it cannot price, so it is never counted as a loss", () => {
    const changes = findOutsideChanges({ cashE6: 0n, positions: { KALSHI: 5n } }, [], { cashE6: 0n, positions: {} }, {});
    expect(changes).toEqual([{ asset: "KALSHI", delta: -5n, valueE6: 0n, priced: false }]);
  });
});

describe("the loss-limit baseline", () => {
  it("scales with a deposit or a withdrawal, keeping the loss where it was", () => {
    // Worth 900 against a baseline of 1000 (down 10%); the owner adds 900: the baseline becomes 2000, still down 10%.
    expect(scaledBaseline(1000n, 1800n, 900n)).toBe(2000n);
    // Withdrawing half at the same loss halves the baseline.
    expect(scaledBaseline(1000n, 450n, -450n)).toBe(500n);
    expect(scaledBaseline(1000n, 900n, 0n)).toBe(1000n);
    // A first deposit starts afresh at what the desk is worth now.
    expect(scaledBaseline(0n, 500n, 500n)).toBe(500n);
  });
});

const sample = (fetchedAtSec: number, tokenPriceE8: bigint): PreStocksSample => ({ symbol: "OPENAI", mint: "m", tokenPriceE8, markPriceE8: 100n, fetchedAtSec });

describe("the half-hour mean and the move that wakes a desk", () => {
  it("needs three samples inside the half hour", () => {
    const now = 10_000;
    expect(meanPriceE8([sample(now - 100, 100n), sample(now - 50, 110n)], now)).toBeNull();
    expect(meanPriceE8([sample(now - 3000, 500n), sample(now - 100, 100n), sample(now - 50, 110n), sample(now, 120n)], now)).toBe(110n);
  });
  it("names the held name that moved the most within the hour, and ignores names not held", () => {
    const feed = { history: (symbol: string) => (symbol === "OPENAI" ? [sample(9_000, 100n), sample(9_500, 104n)] : [sample(9_000, 100n), sample(9_500, 90n)]) };
    expect(heldMoveBps(feed as never, { OPENAI: 1n, ANTHROPIC: 0n }, 10_000)).toEqual({ symbol: "OPENAI", bps: 400 });
    expect(heldMoveBps(feed as never, { OPENAI: 1n, ANTHROPIC: 1n }, 10_000)).toEqual({ symbol: "ANTHROPIC", bps: -1000 });
  });
});
