"use client";

import type { WalletSession } from "@agari/markets/react";
import type { StoredSessionKey } from "./store";

/**
 * The session key as the markets signing seam (D-014), signing with the stored non-extractable `CryptoKeyPair`
 * (D-066): Ed25519 over the transaction's message bytes, exactly what Kit's `createSignerFromKeyPair` does, so the
 * secret never leaves WebCrypto and web never imports Kit (`kit-import-boundary`). Lane 7b's `SessionSigner`
 * `{ keyPair }` variant replaces this adapter one-for-one.
 */
export function keySessionWallet(key: Pick<StoredSessionKey, "address" | "keyPair">): WalletSession {
  const sign = async (bytes: Uint8Array): Promise<Uint8Array> => new Uint8Array(await crypto.subtle.sign("Ed25519", key.keyPair.privateKey, new Uint8Array(bytes)));
  // A Kit `TransactionPartialSigner`: one signature dictionary per transaction, keyed by the key's address.
  const signer = {
    address: key.address,
    signTransactions: (transactions: readonly { messageBytes: Uint8Array }[]) =>
      Promise.all(transactions.map(async (transaction) => Object.freeze({ [key.address]: await sign(transaction.messageBytes) }))),
  } as unknown as WalletSession["signer"];
  return { address: key.address, signer, signMessage: sign };
}
