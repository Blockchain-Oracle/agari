import type { Address } from "@agari/core/types";
import { generateKeyPair, getAddressFromPublicKey } from "@solana/kit";

/**
 * A tap-trading session key (tap-trading.md §2, D-066): a fresh Ed25519 `CryptoKeyPair` from the browser's WebCrypto
 * whose private half is **non-extractable** (Kit's `generateKeyPair()` default). It is stored in IndexedDB as the
 * `CryptoKey` itself (structured clone keeps it non-extractable) and signs through `createSignerFromKeyPair`, so its
 * secret never exists as bytes in the page. `session-key-non-extractable` keeps it that way.
 */
export interface SessionKey {
  address: Address;
  /** WebCrypto's `CryptoKeyPair`, named through Kit so Node-only consumers without the DOM lib still typecheck. */
  keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
}

export async function generateSessionKey(): Promise<SessionKey> {
  const keyPair = await generateKeyPair();
  return { address: (await getAddressFromPublicKey(keyPair.publicKey)) as string as Address, keyPair };
}
