import { describe, expect, it } from "vitest";
import { seriesInRange } from "./view";

const at = (h: number, usd: number) => ({ atSec: 1_000_000 + h * 3_600, totalE6: BigInt(usd) * 1_000_000n });

describe("seriesInRange (S22 value chart)", () => {
  const series = [at(0, 1000), at(12, 990), at(30, 1010), at(48, 1004)];
  const nowSec = 1_000_000 + 48 * 3_600;

  it("measures the whole series in integer money", () => {
    const r = seriesInRange(series, "all", nowSec);
    expect(r.deltaE6).toBe(4_000_000n);
    expect(r.bps).toBe(40);
  });

  it("keeps only the last day for 1d", () => {
    const r = seriesInRange(series, "1d", nowSec);
    expect(r.points.map((p) => p.atSec)).toEqual([series[2]!.atSec, series[3]!.atSec]);
    expect(r.deltaE6).toBe(-6_000_000n);
    expect(r.bps).toBe(-59);
  });

  it("has no move with fewer than two points", () => {
    expect(seriesInRange([at(0, 1000)], "all", nowSec)).toEqual({ points: [at(0, 1000)], deltaE6: null, bps: null });
    expect(seriesInRange([], "1w", nowSec).deltaE6).toBeNull();
  });
});
