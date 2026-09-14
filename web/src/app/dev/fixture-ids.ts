/**
 * Solana-shaped ids for the `/dev` fixtures. Masayume's canned rows named EVM hex addresses, market ids and transaction
 * hashes; these helpers turn each old literal into the base58 of the same bytes, left-padded to the Solana width, so a
 * fixture keeps its identity (and stays distinct) while every value passes the real `Address`/`MarketId`/`Signature`
 * checks at render time. Nothing here is a real account.
 */
import { encodeBase58, toAddress, toMarketId, toSignature, type Address, type MarketId, type Signature } from "@agari/core/types";

function padded(hexOrNumber: string | number | bigint, width: number): Uint8Array {
  const value = typeof hexOrNumber === "string" ? BigInt(hexOrNumber.startsWith("0x") ? hexOrNumber : `0x${hexOrNumber}`) : BigInt(hexOrNumber);
  const out = new Uint8Array(width);
  let rest = value;
  for (let i = width - 1; i >= 0 && rest > 0n; i--) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

/** A 32-byte key whose trailing bytes are the old fixture's hex (or a number). */
export const fixtureAddress = (hexOrNumber: string | number | bigint): Address => toAddress(encodeBase58(padded(hexOrNumber, 32)));

export const fixtureMarketId = (hexOrNumber: string | number | bigint): MarketId => toMarketId(encodeBase58(padded(hexOrNumber, 32)));

/** A 64-byte transaction signature whose trailing bytes are the old fixture hash. */
export const fixtureSignature = (hexOrNumber: string | number | bigint): Signature => toSignature(encodeBase58(padded(hexOrNumber, 64)));
