/**
 * The one rule for identifiers written to and read from these tables (D-010).
 *
 * Solana addresses, Market ids and transaction signatures are base58, which is case-sensitive: re-casing one turns
 * it into a different key, or no key at all. They are stored exactly as written. Only 0x-prefixed hex (keccak
 * match ids, deck hashes, draw ids) folds to lowercase, because hex is case-insensitive and callers mix cases.
 * Base58 can never start with "0x" ("0" isn't in its alphabet), so applying this to every identifier is safe.
 *
 * Masayume lowercased every identifier here after viem's checksummed addresses split its reads from its writes
 * (games.ts history). The fix for that bug was "one canonical form per value", and this keeps that rule.
 */
const HEX_RE = /^0x[0-9a-fA-F]*$/;

export function storageKey(value: string): string {
  return HEX_RE.test(value) ? value.toLowerCase() : value;
}

export function storageKeyOrNull(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : storageKey(value);
}

/** Shape checks for base58 values arriving in JSON (exact byte-length checks live in `@agari/core`). */
export const BASE58_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const BASE58_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
