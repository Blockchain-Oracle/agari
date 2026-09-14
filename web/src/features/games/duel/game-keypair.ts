import { encodeBase58, decodeBase58, toAddress, toSignature, type Address, type Signature } from "@agari/core/types";
import { messageBytes } from "@agari/core/auth";

/**
 * The browser game key as a Solana keypair, made with the runtime's own WebCrypto Ed25519 — no key library ships to the
 * page. The stored secret is the 64-byte Solana form: the 32-byte seed followed by the 32-byte public key, whose base58
 * is the key's address (the same shape `@agari/markets` sessions take as `{ secretKey }`, D-015).
 */

/** PKCS#8 wrapper for a bare Ed25519 seed (RFC 8410): the fixed 16-byte prefix, then the 32 seed bytes. */
const PKCS8_ED25519_PREFIX = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
const SEED_BYTES = 32;
export const SECRET_KEY_BYTES = 64;

export interface GameKeypair {
  address: Address;
  /** seed ‖ public key, 64 bytes. */
  secretKey: Uint8Array;
}

function buffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export async function generateGameKeypair(): Promise<GameKeypair> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const secretKey = new Uint8Array(SECRET_KEY_BYTES);
  secretKey.set(pkcs8.subarray(pkcs8.length - SEED_BYTES), 0);
  secretKey.set(publicKey, SEED_BYTES);
  return { address: toAddress(encodeBase58(publicKey)), secretKey };
}

/** The stored form: base58 of the 64 bytes. Null for anything else, including a Masayume-era EVM record. */
export function parseStoredSecret(text: unknown): GameKeypair | null {
  if (typeof text !== "string") return null;
  const secretKey = decodeBase58(text);
  if (!secretKey || secretKey.length !== SECRET_KEY_BYTES) return null;
  return { address: toAddress(encodeBase58(secretKey.subarray(SEED_BYTES))), secretKey };
}

/** ed25519 over exactly the UTF-8 bytes of `text` (D-012), as base58 — what the room-token route verifies. */
export async function signWithGameKey(secretKey: Uint8Array, text: string): Promise<Signature> {
  const pkcs8 = new Uint8Array(PKCS8_ED25519_PREFIX.length + SEED_BYTES);
  pkcs8.set(PKCS8_ED25519_PREFIX, 0);
  pkcs8.set(secretKey.subarray(0, SEED_BYTES), PKCS8_ED25519_PREFIX.length);
  const key = await crypto.subtle.importKey("pkcs8", buffer(pkcs8), { name: "Ed25519" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, buffer(messageBytes(text))));
  return toSignature(encodeBase58(signature));
}
