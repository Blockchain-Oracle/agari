/**
 * The Pyth receiver's `PriceUpdateV2` account (pyth-solana-receiver-sdk `price_update.rs`), decoded to integers
 * (proof-analytics.md §2.6 step 4). Borsh, little-endian: the verification level is an enum, so `Partial` carries one
 * extra byte and every later offset moves by one. The account is sized for `Partial` (134 B); `Full` leaves one spare.
 */
import { encodeBase58 } from "@agari/core/types";

/** `sha256("account:PriceUpdateV2")[..8]` (also `ops/prints/leftovers.ts`). */
export const PRICE_UPDATE_V2_DISCRIMINATOR = Uint8Array.from([34, 241, 35, 99, 157, 126, 244, 205]);

export type PriceUpdateVerification = { level: "full" } | { level: "partial"; numSignatures: number };

export interface PriceUpdateV2 {
  /** The key that may `reclaim_rent` (base58). */
  writeAuthority: string;
  verification: PriceUpdateVerification;
  /** Lower-case hex without `0x`. */
  feedIdHex: string;
  price: bigint;
  conf: bigint;
  exponent: number;
  publishTimeSec: number;
  prevPublishTimeSec: number;
  emaPrice: bigint;
  emaConf: bigint;
  postedSlot: bigint;
}

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Throws on a wrong discriminator, an unknown verification tag or short data. */
export function decodePriceUpdateV2(data: Uint8Array): PriceUpdateV2 {
  if (data.length < 133) throw new Error(`PriceUpdateV2 needs at least 133 bytes, got ${data.length}`);
  if (!PRICE_UPDATE_V2_DISCRIMINATOR.every((b, i) => data[i] === b)) throw new Error("not a PriceUpdateV2 account (discriminator)");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const writeAuthority = encodeBase58(data.subarray(8, 40));
  const tag = data[40];
  let verification: PriceUpdateVerification;
  let at: number;
  if (tag === 1) {
    verification = { level: "full" };
    at = 41;
  } else if (tag === 0) {
    verification = { level: "partial", numSignatures: data[41]! };
    at = 42;
  } else {
    throw new Error(`unknown verification level tag ${tag}`);
  }
  if (data.length < at + 92) throw new Error(`PriceUpdateV2 truncated at ${data.length} bytes`);
  const feedIdHex = hex(data.subarray(at, at + 32));
  at += 32;
  const i64 = () => ((at += 8), view.getBigInt64(at - 8, true));
  const u64 = () => ((at += 8), view.getBigUint64(at - 8, true));
  const price = i64();
  const conf = u64();
  const exponent = view.getInt32(at, true);
  at += 4;
  const publishTimeSec = Number(i64());
  const prevPublishTimeSec = Number(i64());
  const emaPrice = i64();
  const emaConf = u64();
  const postedSlot = u64();
  return { writeAuthority, verification, feedIdHex, price, conf, exponent, publishTimeSec, prevPublishTimeSec, emaPrice, emaConf, postedSlot };
}

/**
 * The print scale check in integers: `price × 10^(8 + exponent)` against a print at expo −8. An exponent below −8
 * compares the other way round (`price == print × 10^−(8 + exponent)`), so nothing is ever rounded. Returns the
 * signed difference in the finer scale; 0 is an exact match.
 */
export function printDiff(price: bigint, exponent: number, printE8: bigint): bigint {
  const shift = 8 + exponent;
  return shift >= 0 ? price * 10n ** BigInt(shift) - printE8 : price - printE8 * 10n ** BigInt(-shift);
}
