import type { Address, Hash32, MarketId } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { deckCommitment, keccak256 } from "./commitment";

describe("the deck commitment's hash", () => {
  it("is keccak-256 and not SHA3-256", () => {
    // The well-known empty digest. SHA3-256 of nothing is a7ff…, which would pass a weaker check.
    expect(keccak256("0x")).toBe("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
    expect(keccak256(`0x${"00".repeat(32)}`)).toBe("0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563");
  });

  it("is taken over core's preimage, so any field of the deck changes it", () => {
    // Real base58 keys: the preimage decodes an address to its 32 bytes, so a fake one would not encode at all.
    const base = {
      chainId: 103,
      arena: "3aYbq4NtkKSPgjc86yHD6sG5zg5LGLHs1c96dHZD8jeg" as Address,
      matchId: `0x${"11".repeat(32)}` as Hash32,
      policyVersion: 1,
      serverSeed: `0x${"22".repeat(32)}` as Hash32,
      clientSeeds: [`0x${"33".repeat(32)}` as Hash32],
      cards: ["HSLt1X2JUzDhDWnhhEWyKpwkjJY16d4pjf1xNm9Vktmt" as MarketId, "BYPiNP27AeD5tnjWoGXt5mvNyMF8LhfxfjmewA5MgCzX" as MarketId],
    };
    const hash = deckCommitment(base);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(deckCommitment({ ...base, chainId: 101 })).not.toBe(hash);
    expect(deckCommitment({ ...base, cards: [...base.cards].reverse() })).not.toBe(hash);
    expect(deckCommitment({ ...base, policyVersion: 2 })).not.toBe(hash);
  });
});
