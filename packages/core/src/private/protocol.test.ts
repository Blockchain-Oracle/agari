import { describe, expect, it } from "vitest";
import { CLUSTER_ID } from "../constants/chain";
import { testAddress, testMarketIdFromHex, testSignature } from "../testing/ids";
import { PRIVATE_AUTH_TTL_MS, privateAuthFresh, privateCashoutRequestSchema, privateOpenMessage, privateOpenRequestSchema } from "./protocol";

const INPUT = {
  owner: testAddress(0xd3),
  contract: testAddress(0x43),
  chainId: CLUSTER_ID.devnet,
  marketId: testMarketIdFromHex("11".repeat(32)),
  asset: "BTC",
  cadenceText: "5m",
  expirySec: 1_788_400_300,
  side: "up" as const,
  stakeText: "10.00",
  symbol: "tUSDC",
  issuedAtMs: 1_788_400_000_000,
};

describe("privateOpenMessage", () => {
  it("names the actual bet, in a fixed order the desk rebuilds byte for byte", () => {
    expect(privateOpenMessage(INPUT)).toBe(
      [
        "Agari — private bet",
        "",
        "Side: UP",
        "Stake: 10.00 tUSDC",
        "Window: BTC 5m, closes 2026-09-03T01:51:40.000Z",
        `Market: ${INPUT.marketId}`,
        `Desk: ${INPUT.contract} on Solana devnet`,
        `Wallet: ${INPUT.owner}`,
        "Issued: 2026-09-03T01:46:40.000Z",
        "",
        "Signing lets the desk place this one bet from your private balance. It moves no funds by itself and costs nothing. Kept separate from your wallet, so it is harder to link back to you — not anonymous.",
      ].join("\n"),
    );
  });

  it("changes with every field that changes the bet", () => {
    const base = privateOpenMessage(INPUT);
    expect(privateOpenMessage({ ...INPUT, side: "down" })).not.toBe(base);
    expect(privateOpenMessage({ ...INPUT, stakeText: "10.01" })).not.toBe(base);
    expect(privateOpenMessage({ ...INPUT, issuedAtMs: INPUT.issuedAtMs + 1 })).not.toBe(base);
    expect(privateOpenMessage({ ...INPUT, chainId: CLUSTER_ID["mainnet-beta"] })).not.toBe(base);
    expect(privateOpenMessage({ ...INPUT, contract: testAddress(0xab) })).not.toBe(base);
  });
});

describe("privateAuthFresh", () => {
  it("accepts inside the window and refuses stale or future-dated", () => {
    const now = 1_788_400_100_000;
    expect(privateAuthFresh(now - 1_000, now)).toBe(true);
    expect(privateAuthFresh(now - PRIVATE_AUTH_TTL_MS - 1, now)).toBe(false);
    expect(privateAuthFresh(now + 30_000, now)).toBe(true);
    expect(privateAuthFresh(now + 61_000, now)).toBe(false);
  });
});

describe("the wire schemas", () => {
  const SIG = testSignature(0xab);
  it("refuse a claim with a stake that is not a decimal string or an outcome that is not 0/1", () => {
    const claim = { owner: INPUT.owner, slotId: `0x${"aa".repeat(32)}`, creditKey: `0x${"bb".repeat(32)}`, marketId: INPUT.marketId, outcomeIdx: 0, stakeBase: "10000000", issuedAtMs: 1 };
    expect(privateCashoutRequestSchema.safeParse({ claim, signature: SIG }).success).toBe(true);
    expect(privateCashoutRequestSchema.safeParse({ claim: { ...claim, stakeBase: "10.5" }, signature: SIG }).success).toBe(false);
    expect(privateCashoutRequestSchema.safeParse({ claim: { ...claim, outcomeIdx: 2 }, signature: SIG }).success).toBe(false);
  });

  it("accepts the open request the browser sends", () => {
    const parsed = privateOpenRequestSchema.safeParse({ owner: INPUT.owner, marketId: INPUT.marketId, side: "up", stakeBase: "10000000", minQuantityRaw: "15000000", issuedAtMs: INPUT.issuedAtMs, signature: SIG });
    expect(parsed.success).toBe(true);
  });
});
