import { ok } from "@masayume/core/schemas";
import { toMarketId, type Address, type Bytes32 } from "@masayume/core/types";
import type { BinaryMarket, FillRow } from "@somnia-chain/markets-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ listPastBinaryMarkets: vi.fn(), listLiveBinaryMarkets: vi.fn(), getFills: vi.fn(), getRouterActions: vi.fn(), getMarketFees: vi.fn() }));
vi.mock("../runtime/read-runtime", () => ({ getClient: () => client }));
vi.mock("../collateral", () => ({ loadCollateral: async () => ok({ decimals: 6, symbol: "tUSDC" }, Date.now()) }));
import { readVenueBoard } from "./board";
import { marketsInScope } from "./scan";

const wallet = `0x${"11".repeat(20)}` as Address;
const scope = { venueId: `0x${"22".repeat(32)}` as Bytes32, windowStartMs: 100_000_000, windowEndMs: 200_000_000, lookbackSec: 10_000, top: 50 };
// Quoted time fields retain the SDK's wire names; their values are unix seconds.
function market(id: number, expirySec = 150_000, resolvedAtSec = expirySec): BinaryMarket {
  return {
    marketId: toMarketId(`0x${id.toString(16).padStart(64, "0")}`), poolAddress: `0x${id.toString(16).padStart(40, "0")}`,
    marketAddress: wallet, collateral: wallet,
    asset: "BTC", "tradingStart": String(expirySec - 300), "expiry": String(expirySec), "resolvedAtTimestamp": String(resolvedAtSec),
    status: "Finalized", winningOutcome: 0, voided: false, quoteDecimals: 6,
  } as unknown as BinaryMarket;
}
function fill(row: BinaryMarket): FillRow {
  return { market: row.marketId, taker: wallet, takerSide: "BUY_YES", quantity: "1000000", fillPrice: "400000", "timestamp": String(Number(row.expiry) - 100), txHash: `0x${"33".repeat(32)}` } as FillRow;
}
beforeEach(() => {
  vi.resetAllMocks();
  client.listPastBinaryMarkets.mockResolvedValue([]);
  client.getFills.mockResolvedValue([]);
  client.getRouterActions.mockResolvedValue([]);
  client.getMarketFees.mockResolvedValue({ settlementFeeBps: "100" });
});

describe("venue board scan", () => {
  it("keeps late resolutions and complete-set-only rounds, without reading fees for inactive markets", async () => {
    const late = market(1, 90_000, 110_000);
    const minted = market(2);
    const inactive = market(3);
    const old = market(4, 80_000);
    client.listPastBinaryMarkets.mockResolvedValue([minted, inactive, late, old]);
    client.getFills.mockImplementation(async (pool) => pool === late.poolAddress ? [fill(late)] : pool === old.poolAddress ? [fill(old)] : []);
    client.getRouterActions.mockResolvedValue([{ market: minted.marketId, kind: "MintCompleteSet", amount: "1000000", "timestamp": "149900", txHash: `0x${"44".repeat(32)}` }]);
    client.getMarketFees.mockImplementation(async (id) => {
      if (id === inactive.marketId || id === old.marketId) throw new Error("Unused market fee is unavailable");
      return { settlementFeeBps: "100" };
    });
    const reading = await readVenueBoard(scope);
    if (!reading.ok) throw new Error(JSON.stringify(reading.error));
    expect(reading).toMatchObject({ ok: true, stale: false, value: { complete: true, rankedTraders: 1, closedCalls: 2, rankings: [{ owner: wallet, pnlBase: 580_000n, volumeBase: 1_400_000n }] } });
    expect(client.getMarketFees.mock.calls.map(([id]) => id).sort()).toEqual([late.marketId, minted.marketId].sort());
    expect(client.listLiveBinaryMarkets).not.toHaveBeenCalled();
  });

  it("scans past the ranking window boundary because expiry can precede resolution", async () => {
    const first = Array.from({ length: 100 }, (_, i) => market(100 + i, 100_000 - i));
    const late = market(200, 90_000, 110_000);
    const tooOld = { ...market(201, 9_999), "tradingStart": "9000" };
    client.listPastBinaryMarkets.mockResolvedValueOnce(first).mockResolvedValueOnce([late, tooOld]);
    const scanned = await marketsInScope(scope);
    expect(scanned.complete).toBe(true);
    expect(scanned.markets).toContain(late);
    expect(scanned.markets).not.toContain(tooOld);
    expect(scanned.pools.has(tooOld.poolAddress)).toBe(false);
    expect(client.listPastBinaryMarkets).toHaveBeenCalledTimes(2);
    expect(client.listPastBinaryMarkets.mock.calls[1]?.[0]).toMatchObject({ offset: 100, nowSec: 200_000 });
  });

  it("reports a partial board when the market paging cap is reached", async () => {
    client.listPastBinaryMarkets.mockResolvedValue(Array.from({ length: 100 }, (_, i) => market(300 + i)));
    const reading = await readVenueBoard({ ...scope, windowEndMs: scope.windowEndMs + 1 });
    expect(reading).toMatchObject({ ok: true, value: { complete: false } });
    expect(client.listPastBinaryMarkets).toHaveBeenCalledTimes(20);
    expect(client.getMarketFees).not.toHaveBeenCalled();
  });
});
