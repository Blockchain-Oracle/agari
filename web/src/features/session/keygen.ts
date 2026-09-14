import { encodeBase58, toAddress, type Address } from "@agari/core/types";

/**
 * A fresh Solana session key from the browser's own WebCrypto, never an app-side RNG. Stored as the standard
 * 64-byte Solana secret key (32-byte ed25519 seed ‖ 32-byte public key), base58, which the markets session
 * signs with (`{ secretKey }`, D-015). The address is the public half.
 */
export interface GeneratedSessionKey {
  address: Address;
  /** base58 of the 64-byte secret key. */
  secretKey: string;
  createdAtMs: number;
}

/** PKCS#8 for an Ed25519 key is a fixed 16-byte header followed by the 32-byte seed (RFC 8410). */
const PKCS8_ED25519_SEED_OFFSET = 16;

export async function generateSessionKey(nowMs: number = Date.now()): Promise<GeneratedSessionKey> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const seed = pkcs8.subarray(PKCS8_ED25519_SEED_OFFSET);
  if (seed.length !== 32 || publicKey.length !== 32) throw new Error("this browser produced an unexpected Ed25519 key");
  const secretKey = new Uint8Array(64);
  secretKey.set(seed, 0);
  secretKey.set(publicKey, 32);
  return { address: toAddress(encodeBase58(publicKey)), secretKey: encodeBase58(secretKey), createdAtMs: nowMs };
}
