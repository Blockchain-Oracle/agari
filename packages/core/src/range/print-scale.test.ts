import { describe, expect, it } from "vitest";
import { PRINT_EXPO } from "../market/tickers";
import { PRINT_DECIMALS } from "./types";

/**
 * The band arithmetic and every price the range and moonshot tickets draw are scaled by `PRINT_DECIMALS`.
 *
 * It was a literal 2, carried over from a reference that priced in cents, while this venue normalizes every print to
 * `PRINT_EXPO` (10⁻⁸). A band built on the wrong scale is a million times too wide, which is not a rounding error a
 * reader forgives: OPENAI at $1,120.00 drew as "$1,120,001,916", and the reserve refused to quote the band at all.
 */
describe("the range ticket's print scale", () => {
  it("is the venue's own print scale, not the reference's cents", () => {
    expect(PRINT_DECIMALS).toBe(-PRINT_EXPO);
    expect(PRINT_DECIMALS).toBe(8);
  });

  it("turns a real OPENAI print into the dollars the hero shows", () => {
    const openaiPrint = 112_000_191_600n; // the venue's opening print for OPENAI-60m on 2026-09-21
    const dollars = Number(openaiPrint) / 10 ** PRINT_DECIMALS;
    expect(dollars).toBeCloseTo(1_120.0019, 4);
    // and never the million-fold reading the cents scale gave
    expect(Number(openaiPrint) / 100).toBeCloseTo(1_120_001_916, 0);
  });
});
