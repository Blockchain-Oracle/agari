import { LUCKY_ASSETS_V2, LUCKY_MULTIPLIERS, LUCKY_POLICY_V2, mapLuckyDraw } from "@agari/core/games";
import { encodeBase58, toAddress, type Hash32 } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { luckyDigest } from "./lucky-digest.server";

const SERVER_SEED = `0x${"22".repeat(32)}` as Hash32;
const CLIENT_SEED = `0x${"33".repeat(32)}` as Hash32;
/** The old left-padded 20-byte word as a 32-byte Solana key: the message bytes, and so the golden digest, are unchanged (D-010). */
const WALLET = toAddress(encodeBase58(Uint8Array.from((`${"00".repeat(12)}aaaa${"00".repeat(17)}01`.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)))));

/** The other half of core's golden vector (`packages/core/src/games/lucky.test.ts`): the digest node:crypto produces. */
const GOLDEN_DIGEST = "0xaefedfee7e1dc28fd842709c3bb825283102a89ac7e82254ed81d498bce52621";

const toHex = (bytes: Uint8Array) => `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;

describe("the server's HMAC", () => {
  it("lands on the golden digest, and the draw core pins to it", () => {
    const digest = luckyDigest(SERVER_SEED, { clientSeed: CLIENT_SEED, wallet: WALLET, nonce: 7, policyVersion: LUCKY_POLICY_V2 });
    expect(toHex(digest)).toBe(GOLDEN_DIGEST);
    expect(mapLuckyDraw(digest, { assets: LUCKY_ASSETS_V2, multipliers: LUCKY_MULTIPLIERS })).toEqual({ asset: "META", side: "up", multiplier: 10 });
  });

  it("agrees with WebCrypto, which is what the browser's check runs", async () => {
    const { luckyDrawMessage } = await import("@agari/core/games");
    const input = { clientSeed: CLIENT_SEED, wallet: WALLET, nonce: 7, policyVersion: LUCKY_POLICY_V2 };
    const hexBytes = (hex: string) => Uint8Array.from((hex.slice(2).match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));
    const key = await globalThis.crypto.subtle.importKey("raw", hexBytes(SERVER_SEED), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, hexBytes(luckyDrawMessage(input))));
    expect(toHex(signed)).toBe(GOLDEN_DIGEST);
  });

  it("changes the whole draw when the nonce or the client seed changes", () => {
    const base = { clientSeed: CLIENT_SEED, wallet: WALLET, nonce: 7, policyVersion: LUCKY_POLICY_V2 };
    expect(toHex(luckyDigest(SERVER_SEED, { ...base, nonce: 8 }))).not.toBe(GOLDEN_DIGEST);
    expect(toHex(luckyDigest(SERVER_SEED, { ...base, clientSeed: `0x${"34".repeat(32)}` as Hash32 }))).not.toBe(GOLDEN_DIGEST);
    expect(toHex(luckyDigest(`0x${"23".repeat(32)}` as Hash32, base))).not.toBe(GOLDEN_DIGEST);
  });
});
