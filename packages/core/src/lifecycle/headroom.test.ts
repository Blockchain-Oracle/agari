import { describe, expect, it } from "vitest";
import { headroomSec, orderExpirySec } from "./headroom";

describe("headroomSec", () => {
  it("keeps a 30-second buffer for all supported cadences", () => {
    expect(headroomSec(60)).toBe(30);
    for (const interval of [300, 600, 900, 3600, 14400, 86400]) expect(headroomSec(interval)).toBe(30);
  });
});

describe("orderExpirySec", () => {
  const expirySec = 10_000;

  it("is one headroom past now, never beyond the market", () => {
    expect(orderExpirySec(9_000, expirySec, 300)).toBe(9_030);
    expect(orderExpirySec(9_969, expirySec, 300)).toBe(9_999);
  });

  it("is null inside the no-entry buffer", () => {
    expect(orderExpirySec(9_970, expirySec, 300)).toBeNull();
    expect(orderExpirySec(expirySec, expirySec, 300)).toBeNull();
  });
});
