import { describe, expect, it } from "vitest";
import { decideFromSeries, decideOracleFollow, distanceToTriggerBps, moveBps } from "./model";
import { deriveRunnerHealth } from "./health";
import { scoreFill, strategyRecord } from "./record";
import { describeSpec, encodeSpec, parseStrategyMetadata } from "./spec";
import type { StrategyFill } from "./types";
import { testAddress, testMarketId, testSignature } from "../testing/ids";

const spec = { preset: "momentum" as const, lookback: 6, thresholdBps: 20 };

describe("oracle-follow model", () => {
  it("sits out inside the threshold and follows a move past it", () => {
    expect(decideOracleFollow({ openingRaw: 100_000n, priceRaw: 100_010n, spec }).side).toBeNull();
    expect(decideOracleFollow({ openingRaw: 100_000n, priceRaw: 100_300n, spec }).side).toBe("up");
    expect(decideOracleFollow({ openingRaw: 100_000n, priceRaw: 99_700n, spec }).side).toBe("down");
  });
  it("reversion fades the move", () => {
    expect(decideOracleFollow({ openingRaw: 100_000n, priceRaw: 100_300n, spec: { ...spec, preset: "reversion" } }).side).toBe("down");
  });
  it("reads a series over the lookback and reports the distance to the trigger", () => {
    const d = decideFromSeries({ pricesRaw: [1n, 2n, 100_000n, 100_005n, 100_010n], spec: { ...spec, lookback: 3 } });
    expect(d.side).toBeNull();
    expect(distanceToTriggerBps(d)).toBe(19);
    expect(moveBps(0n, 5n)).toBe(0);
  });
});

describe("record", () => {
  const fill = (over: Partial<StrategyFill>): StrategyFill => ({
    txHash: testSignature(1),
    strategyId: 1n,
    grantId: 1n,
    owner: testAddress(1),
    marketId: testMarketId(1),
    side: "up",
    cashDeltaBase: 60n,
    tokenDeltaRaw: 100n,
    atSec: 10,
    dryRun: false,
    ...over,
  });
  it("scores a win, a loss and a void by the chain's rule and builds the curve", () => {
    const win = scoreFill(fill({ atSec: 1 }), { settled: true, voided: false, winningOutcome: 0 }, 0);
    const loss = scoreFill(fill({ atSec: 2, txHash: testSignature(2) }), { settled: true, voided: false, winningOutcome: 1 }, 0);
    const voided = scoreFill(fill({ atSec: 3, txHash: testSignature(3), cashDeltaBase: 50n }), { settled: true, voided: true, winningOutcome: null }, 0);
    const open = scoreFill(fill({ atSec: 4, txHash: testSignature(4) }), null, 0);
    const record = strategyRecord([win, loss, voided, open]);
    expect(win.pnlBase).toBe(40n);
    expect(loss.pnlBase).toBe(-60n);
    expect(voided.pnlBase).toBe(0n);
    expect(record).toMatchObject({ fills: 4, settled: 3, wins: 1, losses: 1, voids: 1, netBase: -20n, stakedBase: 230n });
    expect(record.curve.map((p) => p.cumBase)).toEqual([40n, -20n, -20n]);
  });
});

describe("health and spec", () => {
  it("never computes on a null tick and never says alive when unreachable", () => {
    expect(deriveRunnerHealth({ lastTickMs: null, intervalMs: 30_000, why: null, nowMs: 1_000_000, reachable: true }).kind).toBe("never-started");
    expect(deriveRunnerHealth({ lastTickMs: 900_000, intervalMs: 30_000, why: "x", nowMs: 1_000_000, reachable: true }).kind).toBe("alive");
    expect(deriveRunnerHealth({ lastTickMs: 100_000, intervalMs: 30_000, why: "x", nowMs: 1_000_000, reachable: true }).kind).toBe("stale");
    expect(deriveRunnerHealth({ lastTickMs: 999_000, intervalMs: 30_000, why: "x", nowMs: 1_000_000, reachable: false }).kind).toBe("unknown");
  });
  it("describes and round-trips a spec", () => {
    expect(describeSpec(spec)).toBe("Every round it reads the last 6 prices. If BTC moved at least 0.2%, it bets with that move. Otherwise it sits out.");
    expect(encodeSpec(spec)).toBe('{"p":"momentum","lb":6,"th":20}');
    expect(parseStrategyMetadata('{"name":"A","spec":{"preset":"momentum","lookback":6,"thresholdBps":20}}')?.spec).toEqual(spec);
    expect(parseStrategyMetadata("{}")).toBeNull();
  });
});
