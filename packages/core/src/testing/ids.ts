/**
 * Deterministic, valid test identities (not exported from the package). `n` fills every byte, so
 * `testAddress(1) !== testAddress(2)` and each value passes the real base58 length checks.
 * The `FromHex` forms pin exact bytes, for golden vectors that pack an address as one 32-byte word.
 */
import { encodeBase58 } from "../types/base58";
import { toMarketId, type MarketId } from "../types/ids";
import { toAddress, toSignature, type Address, type Signature } from "../types/primitives";

const filled = (length: number, n: number): Uint8Array => new Uint8Array(length).fill(n & 0xff);

const hexBytes = (hex: string): Uint8Array => Uint8Array.from((hex.replace(/^0x/, "").match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));

export const testAddress = (n: number): Address => toAddress(encodeBase58(filled(32, n)));
export const testMarketId = (n: number): MarketId => toMarketId(encodeBase58(filled(32, n)));
export const testSignature = (n: number): Signature => toSignature(encodeBase58(filled(64, n)));

export const testAddressFromHex = (hex32: string): Address => toAddress(encodeBase58(hexBytes(hex32)));
export const testMarketIdFromHex = (hex32: string): MarketId => toMarketId(encodeBase58(hexBytes(hex32)));
