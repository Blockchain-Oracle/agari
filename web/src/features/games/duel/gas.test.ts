import { requiredGasWei } from "@masayume/markets";
import { describe, expect, it } from "vitest";
import { deckGasWei, PICK_ATTEMPTS_FUNDED, pickFeeWei, sponsorDefaultCapWei, sponsorTopUpWei } from "./gas";

describe("the key's gas envelope and the sponsor's top-up", () => {
  const floor = requiredGasWei("arena");
  const perPick = pickFeeWei();

  it("sizes a deck's envelope as the gate's floor once, plus one pick and one retry per card", () => {
    expect(deckGasWei(3)).toBe(floor + perPick * BigInt(3 * PICK_ATTEMPTS_FUNDED));
    expect(sponsorDefaultCapWei()).toBe(deckGasWei(5));
    // The floor is the ceiling's envelope; the spend is a fraction of it — a five-card key is under one STT.
    expect(deckGasWei(5)).toBeLessThan(10n ** 18n);
    expect(deckGasWei(5) - floor).toBeLessThan(floor);
  });

  it("tops a key up to the envelope and no further", () => {
    const cap = sponsorDefaultCapWei();
    expect(sponsorTopUpWei(3, 0n, cap)).toBe(deckGasWei(3));
    expect(sponsorTopUpWei(3, perPick, cap)).toBe(deckGasWei(3) - perPick);
    // A key already holding its envelope, or more, is sent nothing — a re-ask costs the sponsor nothing.
    expect(sponsorTopUpWei(3, deckGasWei(3), cap)).toBe(0n);
    expect(sponsorTopUpWei(3, deckGasWei(3) * 2n, cap)).toBe(0n);
  });

  it("never sends more than the operator's cap for one match", () => {
    expect(sponsorTopUpWei(5, 0n, perPick)).toBe(perPick);
  });
});
