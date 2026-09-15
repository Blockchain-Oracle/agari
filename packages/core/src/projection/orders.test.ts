import { describe, expect, it } from "vitest";
import type { MarketId } from "../types/market";
import { restingOrderView, sortRestingViews, type RestingOrderRow, type RestingOrderWindow } from "./orders";

const WINDOW: RestingOrderWindow = {
  marketId: "market" as MarketId,
  asset: "TSLA",
  intervalSec: 300,
  tradingStartSec: 10_000,
  lockAtSec: 10_300,
  expirySec: 10_300,
  decimals: 6,
  grid: { lotBase: 1_000n, cashUnit: 1n },
};

const row = (over: Partial<RestingOrderRow> = {}): RestingOrderRow => ({
  signature: "sig",
  market: "market",
  owner: "wallet",
  seat: 3,
  kind: 0,
  order_type: 3,
  limit_price: 550,
  lots: "10000",
  filled_lots: "0",
  rested_lots: "10000",
  remaining_lots: "10000",
  expire_ts_sec: "10090",
  ts_sec: "9000",
  status: "open",
  rested_node: 7,
  rested_seq: "42",
  ...over,
});

describe("restingOrderView", () => {
  it("reads an UP call resting for the open: 10 contracts at 55¢ holding 5.5", () => {
    const v = restingOrderView(row(), WINDOW, 9_500_000);
    expect(v.side).toBe("up");
    expect(v.priceCents).toBe(55);
    expect(v.contractsRaw).toBe(10_000_000n);
    expect(v.escrowBase).toBe(5_500_000n);
    expect(v.status).toBe("resting-for-open");
    expect(v.restUntil).toBe("bell");
    expect(v.handle).toEqual({ node: 7, seq: 42n });
  });

  it("reads a DOWN call (BUY_NO at 450 YES ticks) as DOWN at 55¢ with the same escrow", () => {
    const v = restingOrderView(row({ kind: 2, limit_price: 450 }), WINDOW, 9_500_000);
    expect(v.side).toBe("down");
    expect(v.priceCents).toBe(55);
    expect(v.escrowBase).toBe(5_500_000n);
  });

  it("walks the life of a call: resting after the bell, expired by the clock before the sweep, then the index's own words", () => {
    expect(restingOrderView(row(), WINDOW, 10_010_000).status).toBe("resting");
    expect(restingOrderView(row(), WINDOW, 10_090_000).status).toBe("expired");
    expect(restingOrderView(row({ expire_ts_sec: "10300" }), WINDOW, 9_500_000).restUntil).toBe("lock");
    expect(restingOrderView(row({ status: "filled", remaining_lots: "0", filled_lots: "10000" }), WINDOW, 10_010_000)).toMatchObject({ status: "filled", escrowBase: 0n, handle: null });
    expect(restingOrderView(row({ status: "cancelled", remaining_lots: "0" }), WINDOW, 9_600_000).status).toBe("cancelled");
    expect(restingOrderView(row({ status: "expired", remaining_lots: "0" }), WINDOW, 10_400_000).status).toBe("expired");
  });

  it("orders resting calls first, newest placement first", () => {
    const a = restingOrderView(row({ signature: "a", ts_sec: "9000" }), WINDOW, 9_500_000);
    const b = restingOrderView(row({ signature: "b", ts_sec: "9100", status: "cancelled" }), WINDOW, 9_500_000);
    const c = restingOrderView(row({ signature: "c", ts_sec: "9200" }), WINDOW, 9_500_000);
    expect(sortRestingViews([a, b, c]).map((v) => v.id)).toEqual(["c", "a", "b"]);
  });
});
