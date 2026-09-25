import type { Address } from "@agari/core/types";
import { createKeyPairFromPrivateKeyBytes, getAddressFromPublicKey } from "@solana/kit";
import type { SessionKey } from "../session-key";

/** The session key's seed on a phone: its 32-byte ed25519 private key. */
export const SESSION_KEY_SEED_BYTES = 32;

/**
 * The phone's tap-trading key from its seed (D-128's mobile clause to D-066): a phone cannot keep a WebCrypto key
 * across launches, so the app holds the 32-byte seed in the Keychain / Keystore and this imports it **non-extractable**
 * each time it is needed. The pair then signs through the same `createSubmitterSession({ signer: { keyPair } })` path
 * web's IndexedDB key does; the bytes never leave the secure store and this call.
 */
export async function sessionKeyFromSeed(seed: Uint8Array): Promise<SessionKey> {
  if (seed.length !== SESSION_KEY_SEED_BYTES) throw new Error(`expected a ${SESSION_KEY_SEED_BYTES}-byte session key seed`);
  const keyPair = await createKeyPairFromPrivateKeyBytes(seed);
  return { address: (await getAddressFromPublicKey(keyPair.publicKey)) as string as Address, keyPair };
}

/** A fresh key for the phone: 32 random bytes (the app stores them) and the non-extractable pair they import to. */
export async function newSessionKeySeed(): Promise<{ seed: Uint8Array; key: SessionKey }> {
  const seed = crypto.getRandomValues(new Uint8Array(SESSION_KEY_SEED_BYTES));
  return { seed, key: await sessionKeyFromSeed(seed) };
}
