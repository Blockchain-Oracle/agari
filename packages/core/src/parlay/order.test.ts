import { describe, expect, it } from "vitest";
import { nextParlayLegIdx } from "./order";

const leg = (expirySec: number, status: "pending" | "won" | "lost" | "void" = "pending") => ({ expirySec, status });

describe("nextParlayLegIdx", () => {
  it("names the pending leg whose Window closes first, whatever order the legs were picked in", () => {
    expect(nextParlayLegIdx([leg(900), leg(300), leg(600)])).toBe(1);
    expect(nextParlayLegIdx([leg(900), leg(300, "won"), leg(600)])).toBe(2);
    expect(nextParlayLegIdx([leg(900), leg(300, "won"), leg(600, "won")])).toBe(0);
  });

  it("takes the lowest index when legs share a boundary, as the program does", () => {
    expect(nextParlayLegIdx([leg(600), leg(600)])).toBe(0);
    expect(nextParlayLegIdx([leg(600, "won"), leg(600)])).toBe(1);
  });

  it("is null once every leg has an answer", () => {
    expect(nextParlayLegIdx([leg(300, "won"), leg(600, "lost")])).toBeNull();
    expect(nextParlayLegIdx([])).toBeNull();
  });
});
