import { LUCKY_ASSETS, LUCKY_MULTIPLIERS, LUCKY_POLICY_VERSION, mapLuckyDraw } from "@masayume/core/games";
import type { Address, Bytes32 } from "@masayume/core/types";
import { describe, expect, it } from "vitest";
import { luckyDigest } from "./lucky-digest.server";

const SERVER_SEED = `0x${"22".repeat(32)}` as Bytes32;
const CLIENT_SEED = `0x${"33".repeat(32)}` as Bytes32;
const WALLET = "0xaaaa000000000000000000000000000000000001" as Address;

/** The other half of core's golden vector (`packages/core/src/games/lucky.test.ts`): the digest node:crypto produces. */
const GOLDEN_DIGEST = "0x24fba7527be1e82474ae75357b23615d5585e1038d487d3f8ebde5b99ec0af26";

const toHex = (bytes: Uint8Array) => `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;

describe("the server's HMAC", () => {
  it("lands on the golden digest, and the draw core pins to it", () => {
    const digest = luckyDigest(SERVER_SEED, { clientSeed: CLIENT_SEED, wallet: WALLET, nonce: 7, policyVersion: LUCKY_POLICY_VERSION });
    expect(toHex(digest)).toBe(GOLDEN_DIGEST);
    expect(mapLuckyDraw(digest, { assets: LUCKY_ASSETS, multipliers: LUCKY_MULTIPLIERS })).toEqual({ asset: "BTC", side: "down", multiplier: 5 });
  });

  it("agrees with WebCrypto, which is what the browser's check runs", async () => {
    const { luckyDrawMessage } = await import("@masayume/core/games");
    const input = { clientSeed: CLIENT_SEED, wallet: WALLET, nonce: 7, policyVersion: LUCKY_POLICY_VERSION };
    const hexBytes = (hex: string) => Uint8Array.from((hex.slice(2).match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));
    const key = await globalThis.crypto.subtle.importKey("raw", hexBytes(SERVER_SEED), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, hexBytes(luckyDrawMessage(input))));
    expect(toHex(signed)).toBe(GOLDEN_DIGEST);
  });

  it("changes the whole draw when the nonce or the client seed changes", () => {
    const base = { clientSeed: CLIENT_SEED, wallet: WALLET, nonce: 7, policyVersion: LUCKY_POLICY_VERSION };
    expect(toHex(luckyDigest(SERVER_SEED, { ...base, nonce: 8 }))).not.toBe(GOLDEN_DIGEST);
    expect(toHex(luckyDigest(SERVER_SEED, { ...base, clientSeed: `0x${"34".repeat(32)}` as Bytes32 }))).not.toBe(GOLDEN_DIGEST);
    expect(toHex(luckyDigest(`0x${"23".repeat(32)}` as Bytes32, base))).not.toBe(GOLDEN_DIGEST);
  });
});
