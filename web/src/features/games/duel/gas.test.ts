import { FEE_RESERVE_LAMPORTS } from "@agari/core/constants";
import { describe, expect, it } from "vitest";
import { deckFeeLamports, PICK_ATTEMPTS_FUNDED, pickFeeLamports, sponsorDefaultCapLamports, sponsorTopUpLamports } from "./gas";

describe("the key's fee envelope and the sponsor's top-up", () => {
  const perPick = pickFeeLamports();

  it("sizes a deck's envelope as the fee reserve once, plus one pick and one retry per card", () => {
    expect(deckFeeLamports(3)).toBe(FEE_RESERVE_LAMPORTS + perPick * BigInt(3 * PICK_ATTEMPTS_FUNDED));
    expect(sponsorDefaultCapLamports()).toBe(deckFeeLamports(5));
  });

  it("tops a key up to the envelope and no further", () => {
    const cap = sponsorDefaultCapLamports();
    expect(sponsorTopUpLamports(3, 0n, cap)).toBe(deckFeeLamports(3));
    expect(sponsorTopUpLamports(3, perPick, cap)).toBe(deckFeeLamports(3) - perPick);
    // A key already holding its envelope, or more, is sent nothing — a re-ask costs the sponsor nothing.
    expect(sponsorTopUpLamports(3, deckFeeLamports(3), cap)).toBe(0n);
    expect(sponsorTopUpLamports(3, deckFeeLamports(3) * 2n, cap)).toBe(0n);
  });

  it("never sends more than the operator's cap for one match", () => {
    expect(sponsorTopUpLamports(5, 0n, perPick)).toBe(perPick);
  });
});
