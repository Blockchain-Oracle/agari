import { describe, expect, it } from "vitest";
import { crossingOf } from "./crossing";

const level = (priceBps: number) => ({ priceBps, priceRaw: BigInt(priceBps) * 100n, quantityRaw: 1_000_000n });
const book = (upAsk: number | null, downAsk: number | null) => ({ upAsks: upAsk === null ? [] : [level(upAsk)], downAsks: downAsk === null ? [] : [level(downAsk)] });

describe("crossingOf", () => {
  it("rests under the best ask on its own side and takes at or above it", () => {
    expect(crossingOf("up", 54, book(5_500, null))).toBeNull();
    expect(crossingOf("up", 55, book(5_500, null))).toEqual({ otherSide: "down", otherCents: 45, maxCents: 54 });
    expect(crossingOf("down", 56, book(null, 5_600))).toEqual({ otherSide: "up", otherCents: 44, maxCents: 55 });
  });
  it("reads an ask between cents rounded up, so 55¢ still rests under a 55.4¢ ask", () => {
    expect(crossingOf("up", 55, book(5_540, null))).toBeNull();
    expect(crossingOf("up", 56, book(5_540, null))).toEqual({ otherSide: "down", otherCents: 44, maxCents: 55 });
  });
  it("names nothing to rest under when the ask sits at a cent", () => {
    expect(crossingOf("up", 1, book(100, null))).toEqual({ otherSide: "down", otherCents: 99, maxCents: 0 });
  });
  it("never crosses an empty side, whatever the other side rests", () => {
    expect(crossingOf("up", 99, book(null, 100))).toBeNull();
  });
});
