import { describe, expect, it } from "vitest";
import { toMarketId } from "../types/ids";
import { marketDeepLink, marketIdFromPath, marketPath } from "./app";

// A real devnet Market PDA: the guard is a base58 address check, so a placeholder would not exercise it.
const ID = toMarketId("8TKpztjhugk5q66eu8kSr78zkf5r19ZpPdCJJjT6igS7");

describe("the path form of a Window's address", () => {
  it("round-trips through marketPath", () => {
    expect(marketIdFromPath(marketPath(ID))).toBe(ID);
  });

  it("reads a trailing slash and a percent-encoded path the same way", () => {
    expect(marketIdFromPath(`/markets/${ID}/`)).toBe(ID);
    expect(marketIdFromPath(`/markets/${encodeURIComponent(ID)}`)).toBe(ID);
  });

  it("names no Window for the board itself", () => {
    // `/markets` must keep resolving from `?m=`; a board that claimed to be a Window would pin the wrong one.
    expect(marketIdFromPath("/markets")).toBeNull();
    expect(marketIdFromPath("/markets/")).toBeNull();
  });

  it("refuses a path that is not a Market address rather than inventing one", () => {
    expect(marketIdFromPath("/markets/not-an-address")).toBeNull();
    expect(marketIdFromPath(`/markets/${ID}/extra`)).toBeNull();
    expect(marketIdFromPath("/portfolio")).toBeNull();
    expect(marketIdFromPath(null)).toBeNull();
    expect(marketIdFromPath(undefined)).toBeNull();
  });

  it("leaves the query grammar alone", () => {
    // Both forms are the same address (UX-DR21); the query one is what the page writes back as you move around.
    expect(marketDeepLink({ marketId: ID })).toBe(`/markets?m=${ID}`);
    expect(marketDeepLink({ marketId: ID, dir: "down" })).toBe(`/markets?m=${ID}&dir=down`);
  });
});
