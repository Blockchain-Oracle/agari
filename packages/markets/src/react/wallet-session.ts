import type { Address } from "@agari/core";

/**
 * The one wallet seam the web hands to markets (D-014). Raw bytes in, raw bytes out, so the Privy provider island
 * never needs a chain SDK, and markets adapts it to a `@solana/kit` signer inside the chain boundary.
 *
 * Privy's `ConnectedStandardSolanaWallet` satisfies it for both embedded wallets and external Wallet Standard
 * wallets (Phantom, Backpack, Solflare) connected through Privy's Solana connectors.
 */
export interface WalletSession {
  address: Address;
  /** `embedded` sends can ask Privy to sponsor the fee; `external` sends go through the `api/sponsor` co-sign or pay their own. */
  kind: "embedded" | "external";
  /** ed25519 over exactly these bytes (Wallet Standard `solana:signMessage`); returns the 64 signature bytes. */
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  /** Signs a wire-encoded transaction (possibly already signed by a fee-payer co-signer) and returns the signed wire bytes. */
  signTransaction(transaction: Uint8Array): Promise<Uint8Array>;
  /** Signs and broadcasts; `sponsor` asks Privy to pay the fee (embedded wallets only). Returns the 64 signature bytes. */
  signAndSendTransaction(transaction: Uint8Array, options: { sponsor: boolean }): Promise<Uint8Array>;
}
