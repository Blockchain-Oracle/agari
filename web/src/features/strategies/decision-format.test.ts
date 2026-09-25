import { describe, expect, it } from "vitest";
import { fillPriceCents } from "./decision-format";

const ONE = 1_000_000n;

describe("fillPriceCents", () => {
  it("prices a fill as its cost over its shares", () => {
    expect(fillPriceCents((2n * ONE + 170_000n).toString(), (5n * ONE).toString())).toBe(43.4);
    expect(fillPriceCents((2n * ONE).toString(), (4n * ONE).toString())).toBe(50);
  });

  it("has no price without shares", () => {
    expect(fillPriceCents("100", "0")).toBeNull();
    expect(fillPriceCents("-5", "10")).toBeNull();
  });
});
