import type { MarketId } from "@masayume/core/types";
import { keys } from "@masayume/markets/react";
import { describe, expect, it } from "vitest";
import { isPersistable } from "./persist";

const WALLET = "0xd357000000000000000000000000000000009358";
const MARKET = `0x${"ab".repeat(32)}` as unknown as MarketId;

describe("read-cache persistence allowlist", () => {
  it("stores the public, chain-scoped facts that make a reload cheap", () => {
    expect(isPersistable(keys.collateral())).toBe(true);
    expect(isPersistable(keys.venue())).toBe(true);
    expect(isPersistable(keys.bookParams("0xpool"))).toBe(true);
  });

  it("never stores anything scoped to an account", () => {
    for (const key of [
      keys.positions(WALLET),
      keys.balanceSheet(WALLET),
      keys.history(WALLET),
      keys.vault(WALLET),
      keys.claimables(WALLET, null),
      keys.privateBudget(WALLET),
      keys.leveragePositions(WALLET),
      keys.parlays(WALLET),
      keys.ranges(WALLET),
      keys.makerShares(WALLET),
    ]) {
      expect(isPersistable(key)).toBe(false);
    }
  });

  it("never stores a number that goes stale in seconds", () => {
    for (const key of [keys.lanes(null), keys.onchain(MARKET), keys.assetPrice("ETH"), keys.market(MARKET)]) {
      expect(isPersistable(key)).toBe(false);
    }
  });

  it("does not store the chain clock — a remembered clock offset is worse than none", () => {
    expect(isPersistable(keys.clock())).toBe(false);
  });
});
