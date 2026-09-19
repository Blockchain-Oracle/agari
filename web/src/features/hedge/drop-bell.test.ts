import { describe, expect, it } from "vitest";
import { bpsToPctText, DROP_BPS, dropBps, hourHigh, keepHour, type PriceSample } from "./drop-bell";

const s = (sec: number, raw: bigint): PriceSample => ({ sec, raw });

describe("drop bell", () => {
  it("measures the fall from the hour's high in basis points, integer only", () => {
    const ring = [s(0, 100_000n), s(60, 103_000n), s(120, 99_910n)];
    expect(dropBps(ring)).toBe(300n); // 103,000 → 99,910 is exactly 3%
    expect(dropBps(ring) >= DROP_BPS).toBe(true);
    expect(dropBps([s(0, 100_000n), s(60, 103_000n), s(120, 99_911n)]) >= DROP_BPS).toBe(false); // 2.99% does not ring
    expect(dropBps([s(0, 100_000n)])).toBe(0n);
    expect(dropBps([])).toBe(0n);
  });
  it("forgets a high older than an hour, so a stale peak cannot ring the bell", () => {
    let ring: PriceSample[] = [];
    ring = keepHour(ring, s(0, 110_000n));
    ring = keepHour(ring, s(1800, 100_000n));
    expect(dropBps(ring)).toBe(909n); // 110,000 → 100,000
    ring = keepHour(ring, s(3601, 100_000n)); // the 110,000 sample is now older than the window
    expect(ring.map((x) => x.sec)).toEqual([1800, 3601]);
    expect(dropBps(ring)).toBe(0n);
    expect(hourHigh(ring)?.sec).toBe(1800);
  });
  it("prints basis points as a rounded tenth of a percent", () => {
    expect(bpsToPctText(300n)).toBe("3.0");
    expect(bpsToPctText(344n)).toBe("3.4");
    expect(bpsToPctText(345n)).toBe("3.5");
    expect(bpsToPctText(909n)).toBe("9.1");
  });
});
