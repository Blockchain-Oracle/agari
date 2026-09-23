import nacl from "tweetnacl";

/**
 * The deeplink wallets' encryption (Phantom's "Encryption" doc; Solflare uses the same): an x25519 key exchange and
 * NaCl box. Randomness comes from WebCrypto, which every runtime Agari runs in has (browser, Node, the app's Hermes).
 */
nacl.setPRNG((out, n) => out.set(globalThis.crypto.getRandomValues(new Uint8Array(n))));

export interface BoxKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export const newBoxKeyPair = (): BoxKeyPair => nacl.box.keyPair();
export const boxKeyPairFromSecret = (secretKey: Uint8Array): BoxKeyPair => nacl.box.keyPair.fromSecretKey(secretKey);
export const sharedSecret = (walletPublicKey: Uint8Array, dappSecretKey: Uint8Array): Uint8Array => nacl.box.before(walletPublicKey, dappSecretKey);

export function seal(payload: unknown, shared: Uint8Array): { nonce: Uint8Array; data: Uint8Array } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  return { nonce, data: nacl.box.after(new TextEncoder().encode(JSON.stringify(payload)), nonce, shared) };
}

export function open<T>(data: Uint8Array, nonce: Uint8Array, shared: Uint8Array): T {
  const plain = nacl.box.open.after(data, nonce, shared);
  if (!plain) throw new Error("the wallet's reply did not decrypt");
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
