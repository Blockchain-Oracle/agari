import type { Bytes32, EventMarket } from "@masayume/core/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lanes: vi.fn(), opening: vi.fn(), price: vi.fn() }));
vi.mock("@masayume/markets", () => ({ marketsProvider: { listLiveLanes: mocks.lanes, getOpeningPrice: mocks.opening, getAssetPrice: mocks.price } }));
import { scanVenue } from "./decide";

const VENUE = `0x${"22".repeat(32)}` as Bytes32;
const market = { marketId: `0x${"11".repeat(32)}`, asset: "ETH", intervalSec: 900, tradingStartSec: 1_000, expirySec: 1_900, openingPriceRaw: 250_000n, status: "Trading", voided: false, finalized: false } as EventMarket;
const ok = <T>(value: T) => ({ ok: true as const, value, stale: false, asOfMs: 1_300_000 });
const spec = { preset: "momentum" as const, lookback: 6, thresholdBps: 10 };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.lanes.mockResolvedValue(ok({ lanes: [{ markets: [market] }] }));
  mocks.opening.mockResolvedValue(ok(250_000n)); // $2,500.00 in oracle cents.
});

describe("Momentum compares the oracle and feed on a common scale", () => {
  it.each([6, 8, 18])("holds a genuine +2bps move from a %sdp feed under a 10bps threshold", async (decimals) => {
    mocks.price.mockResolvedValue(ok({ emaRaw: 250_050n * 10n ** BigInt(decimals - 2), decimals }));
    const scan = await scanVenue(VENUE, spec, 1_300_000);
    expect(scan.candidates).toHaveLength(0);
    expect(scan.closestBps).toBe(8);
  });
  it.each([[250_500n, "up"], [249_500n, "down"]] as const)("preserves the real direction at %s oracle cents", async (cents, side) => {
    mocks.price.mockResolvedValue(ok({ emaRaw: cents * 10n ** 16n, decimals: 18 }));
    const scan = await scanVenue(VENUE, spec, 1_300_000);
    expect(scan.candidates[0]?.decision).toMatchObject({ side, moveBps: side === "up" ? 20 : -20 });
  });
  it("does not invent a signal from unknown units", async () => {
    mocks.price.mockResolvedValue(ok({ emaRaw: 2_505n, decimals: Number.NaN }));
    await expect(scanVenue(VENUE, spec, 1_300_000)).rejects.toThrow("units could not be reconciled");
  });
});
