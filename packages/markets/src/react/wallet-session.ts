import type { Address } from "@agari/core";
import type { TransactionSigner } from "@solana/kit";

/**
 * The one wallet seam the web hands to markets (D-014, reshaped by D-023).
 *
 * The web's wallet island connects a Wallet Standard wallet (Phantom, Solflare, Backpack, …) through Anza's
 * `@solana/kit-plugin-wallet` and hands over the connected account as a Kit `TransactionSigner`, the type Kit's own
 * transaction pipeline signs with, so markets builds, signs and sends every transaction without an adapter layer.
 */
export interface WalletSession {
  address: Address;
  /** The connected account's Kit signer (Wallet Standard `solana:signTransaction` / `solana:signAndSendTransaction`). */
  signer: TransactionSigner;
  /** ed25519 over exactly these bytes (Wallet Standard `solana:signMessage`); returns the 64 signature bytes. */
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}
