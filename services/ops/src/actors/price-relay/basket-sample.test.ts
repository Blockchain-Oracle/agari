import { describe, expect, it, vi } from "vitest";
import { BASKET_INDEX_BASE_E8, BASKETS, type PreIpoSymbol } from "@agari/core/market";

// The prints barrel re-exports Pyth modules that do not load in this environment; only the window constant is needed.
vi.mock("@agari/markets/ops/prints", () => ({ PRESTOCKS_MAX_LATE_SEC: 45 }));

const { chooseBasketSample } = await import("./basket-sample");
import type { PreStocksSnapshot } from "../../prices/prestocks-spot";

const T = 1_789_800_000;
const slot = { boundarySec: T, earliestSec: T + 10 };
const PREDMKTS = BASKETS.PREDMKTS;
const read = (fetchedAtSec: number, factorBps: bigint, omit?: PreIpoSymbol): PreStocksSnapshot => ({
  fetchedAtSec,
  samples: new Map(PREDMKTS.members.filter((m) => m.symbol !== omit).map((m) => [m.symbol, { symbol: m.symbol, mint: "m", tokenPriceE8: (m.basePriceE8! * factorBps) / 10_000n, markPriceE8: 1n, fetchedAtSec }])),
  missing: omit ? [omit] : [],
});

describe("chooseBasketSample", () => {
  it("takes the first complete read inside [T+10, T+45], skipping an earlier read that missed a member", () => {
    const snapshots = [read(T - 20, 10_000n), read(T + 5, 10_000n), read(T + 12, 10_000n, "KALSHI"), read(T + 22, 20_000n), read(T + 32, 30_000n), read(T + 60, 40_000n)];
    expect(chooseBasketSample(snapshots, PREDMKTS, slot, T + 30)).toEqual({ sample: { symbol: "PREDMKTS", indexE8: BASKET_INDEX_BASE_E8 * 2n, fetchedAtSec: T + 22 } });
  });

  it("never takes a read outside the window, however complete", () => {
    expect(chooseBasketSample([read(T + 5, 10_000n), read(T + 46, 10_000n)], PREDMKTS, slot, T + 50)).toMatchObject({ missed: expect.stringContaining("voids") });
  });

  it("waits while the window is open and no complete read has landed, and gives up once it has closed", () => {
    const partial = [read(T + 15, 10_000n, "POLYMARKET")];
    expect(chooseBasketSample(partial, PREDMKTS, slot, T + 20)).toMatchObject({ waiting: expect.stringContaining("1 read(s) missed a member") });
    expect(chooseBasketSample([], PREDMKTS, slot, T + 45)).toMatchObject({ waiting: expect.stringContaining("PREDMKTS") });
    expect(chooseBasketSample(partial, PREDMKTS, slot, T + 46)).toMatchObject({ missed: expect.stringContaining("1 read(s) missed a member") });
  });
});
