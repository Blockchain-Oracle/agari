import { describe, expect, it } from "vitest";
import { dayChange, formatDayChange } from "./day-change";

const CLOSE_SEC = 1_789_416_000; // Mon 09-14 16:00 ET
const PREV_SEC = 1_789_156_800; // Fri 09-11 16:00 ET
/** Prices on the oracle's 10⁻⁸ scale. */
const E8 = 100_000_000n;
const usd = (dollars: bigint, cents: bigint) => dollars * E8 + cents * 1_000_000n;
const closes = { last: { sec: CLOSE_SEC, priceRaw: usd(359n, 7n) }, prev: { sec: PREV_SEC, priceRaw: usd(362n, 19n) } };

describe("dayChange", () => {
  it("measures a moved pre-market tick from the last close", () => {
    const change = dayChange(usd(357n, 10n), CLOSE_SEC + 13 * 3600, closes);
    expect(change).toMatchObject({ deltaRaw: -usd(1n, 97n), since: "close", sinceSec: CLOSE_SEC, referenceRaw: usd(359n, 7n) });
    expect(change?.bps).toBe(-54);
    expect(formatDayChange(change!)).toEqual({ dollars: "−$1.97", percent: "−0.54%", direction: "down" });
  });
  it("measures the archived close, or a feed that repeats it overnight, from the previous close", () => {
    expect(dayChange(usd(359n, 7n), CLOSE_SEC, closes)).toMatchObject({ deltaRaw: -usd(3n, 12n), since: "prevClose", sinceSec: PREV_SEC });
    expect(dayChange(usd(359n, 7n), CLOSE_SEC + 13 * 3600, closes)).toMatchObject({ since: "prevClose", bps: -86 });
    expect(formatDayChange(dayChange(usd(359n, 7n), CLOSE_SEC, closes)!)).toEqual({ dollars: "−$3.12", percent: "−0.86%", direction: "down" });
  });
  it("measures from the session's open when the archive holds no previous close", () => {
    const open = { sec: CLOSE_SEC - 6 * 3600 - 1800, priceRaw: usd(360n, 0n) };
    expect(dayChange(usd(359n, 7n), CLOSE_SEC, { last: closes.last, prev: null }, open)).toMatchObject({ since: "open", sinceSec: open.sec, deltaRaw: -usd(0n, 93n) });
    // A moved after-hours tick still measures from the close, open or no open.
    expect(dayChange(usd(357n, 10n), CLOSE_SEC + 3600, { last: closes.last, prev: null }, open)).toMatchObject({ since: "close" });
  });
  it("is null without the close it needs, and never divides by a zero close", () => {
    expect(dayChange(usd(359n, 7n), CLOSE_SEC, { last: closes.last, prev: null })).toBeNull();
    // No last close known: the previous close is still a session to measure from.
    expect(dayChange(usd(360n, 0n), CLOSE_SEC + 60, { last: null, prev: closes.prev })).toMatchObject({ since: "prevClose" });
    expect(dayChange(usd(360n, 0n), CLOSE_SEC + 60, { last: { sec: CLOSE_SEC, priceRaw: 0n }, prev: null })).toBeNull();
  });
  it("formats up and flat moves with their sign, dollars at the line's scale", () => {
    const up = dayChange(usd(362n, 67n), CLOSE_SEC + 60, closes)!;
    expect(formatDayChange(up)).toEqual({ dollars: "+$3.60", percent: "+1.00%", direction: "up" });
    const flat = dayChange(usd(362n, 19n), CLOSE_SEC, closes)!;
    expect(formatDayChange(flat)).toEqual({ dollars: "$0.00", percent: "0.00%", direction: "flat" });
    const big = dayChange(usd(150_000n, 0n), CLOSE_SEC + 60, { last: { sec: CLOSE_SEC, priceRaw: usd(100_000n, 0n) }, prev: null })!;
    expect(formatDayChange(big)).toEqual({ dollars: "+$50,000", percent: "+50.00%", direction: "up" });
  });
});
