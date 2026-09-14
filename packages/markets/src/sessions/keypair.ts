import { decodeBase58, encodeBase58, toAddress, type Address } from "@agari/core/types";

/**
 * A server role's Solana keypair (`~/.config/agari/devnet/<role>.json`): 64 bytes, the 32-byte ed25519 seed followed
 * by its 32-byte public key. The address is those last 32 bytes. The S4 kit adapter's `createKeyPairFromBytes`
 * also checks that the public half matches the seed before anything signs.
 */
export const SECRET_KEY_BYTES = 64;

/** Accepts the Solana CLI JSON array (`[12,34,…]`) or a base58 string, as env vars carry either. */
export function parseSecretKey(text: string): Uint8Array {
  const trimmed = text.trim();
  let bytes: Uint8Array | null = null;
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) bytes = Uint8Array.from(parsed as number[]);
  } else {
    bytes = decodeBase58(trimmed);
  }
  if (!bytes || bytes.length !== SECRET_KEY_BYTES) throw new Error(`expected a ${SECRET_KEY_BYTES}-byte Solana keypair (JSON array or base58)`);
  return bytes;
}

export function keypairAddress(secretKey: Uint8Array): Address {
  if (secretKey.length !== SECRET_KEY_BYTES) throw new Error(`expected a ${SECRET_KEY_BYTES}-byte Solana keypair`);
  return toAddress(encodeBase58(secretKey.subarray(32)));
}
