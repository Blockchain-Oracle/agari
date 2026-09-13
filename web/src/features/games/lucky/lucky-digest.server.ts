import { createHmac, randomBytes } from "node:crypto";
import { luckyDrawMessage, type LuckyDrawInput } from "@masayume/core/games";
import type { Bytes32, Hex } from "@masayume/core/types";

/**
 * The server's half of the provable draw — the only place `node:crypto` touches Lucky.
 *
 * The browser recomputes exactly this with WebCrypto (`useLuckyCheck`), which is why the message is
 * core's `luckyDrawMessage` and nothing else: one byte layout, two implementations, one golden vector
 * (`lucky-hmac.test.ts`) keeping them honest.
 */

const hexBytes = (hex: Hex): Buffer => Buffer.from(hex.slice(2), "hex");

/** HMAC-SHA256, keyed by the committed server seed, over the canonical message. */
export function luckyDigest(serverSeed: Bytes32, input: LuckyDrawInput): Uint8Array {
  return new Uint8Array(createHmac("sha256", hexBytes(serverSeed)).update(hexBytes(luckyDrawMessage(input))).digest());
}

/** A fresh 32-byte seed from the platform's CSPRNG. */
export function freshSeed(): Bytes32 {
  return `0x${randomBytes(32).toString("hex")}`;
}
