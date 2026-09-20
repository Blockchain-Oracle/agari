import { describe, expect, it } from "vitest";
import { centerQE6OfTicks, YES_TICK_TO_E6 } from "./mark";

describe("centerQE6OfTicks", () => {
  it("reads a YES tick as a thousandth of probability, as the program does", () => {
    expect(YES_TICK_TO_E6).toBe(1_000n);
    expect(centerQE6OfTicks(500)).toBe(500_000n);
    expect(centerQE6OfTicks(650n)).toBe(650_000n);
    expect(centerQE6OfTicks(1)).toBe(1_000n);
    expect(centerQE6OfTicks(999)).toBe(999_000n);
  });

  it("keeps the whole grid inside the reserve's centre bounds' own scale", () => {
    // DEVNET_RANGE_PARAMS admits centres from 30,000 to 970,000: ticks 30 to 970, which is 3.0¢ to 97.0¢.
    expect(centerQE6OfTicks(30)).toBe(30_000n);
    expect(centerQE6OfTicks(970)).toBe(970_000n);
  });
});
