import { toAddress, type Address } from "@agari/core/types";
import type { WalletSession as MarketsWalletSession } from "@agari/markets/react";
import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import type { PrivySolanaChain } from "../solana-client";

/** The three Privy Solana hooks the seam needs, narrowed to the calls it makes. */
export interface PrivySigners {
  signMessage(input: { message: Uint8Array; wallet: ConnectedStandardSolanaWallet }): Promise<{ signature: Uint8Array }>;
  signTransaction(input: { transaction: Uint8Array; wallet: ConnectedStandardSolanaWallet; chain: PrivySolanaChain }): Promise<{ signedTransaction: Uint8Array }>;
  signAndSendTransaction(input: {
    transaction: Uint8Array;
    wallet: ConnectedStandardSolanaWallet;
    chain: PrivySolanaChain;
    options: { sponsor: boolean };
  }): Promise<{ signature: Uint8Array }>;
}

/** A linked account as far as embedded-wallet detection needs it. */
interface LinkedAccountLike {
  type: string;
  address?: string;
  chainType?: string;
  walletClientType?: string;
}

/** The address of the user's Privy-embedded Solana wallet, if they have one (created on login for users without a wallet). */
export function embeddedSolanaAddress(linkedAccounts: readonly LinkedAccountLike[] | undefined): string | null {
  const embedded = linkedAccounts?.find((a) => a.type === "wallet" && a.chainType === "solana" && a.walletClientType === "privy");
  return embedded?.address ?? null;
}

/**
 * The active wallet: Privy lists Solana wallets most recently connected first, which is the one the user last chose.
 * Returns null for an address that isn't a valid 32-byte base58 key, rather than handing markets a bad signer.
 */
export function activeWallet(wallets: readonly ConnectedStandardSolanaWallet[]): { wallet: ConnectedStandardSolanaWallet; address: Address } | null {
  const wallet = wallets[0];
  if (!wallet) return null;
  try {
    return { wallet, address: toAddress(wallet.address) };
  } catch {
    return null;
  }
}

/**
 * Builds the D-014 seam from a Privy wallet. Sponsorship is asked for only on embedded wallets: Privy's native
 * sponsorship covers them, while an external wallet's fee goes through the `api/sponsor` co-sign or its own SOL.
 */
export function toWalletSession(
  wallet: ConnectedStandardSolanaWallet,
  address: Address,
  kind: "embedded" | "external",
  signers: PrivySigners,
  chain: PrivySolanaChain,
): MarketsWalletSession {
  return {
    address,
    kind,
    async signMessage(message) {
      return (await signers.signMessage({ message, wallet })).signature;
    },
    async signTransaction(transaction) {
      return (await signers.signTransaction({ transaction, wallet, chain })).signedTransaction;
    },
    async signAndSendTransaction(transaction, options) {
      const sponsor = kind === "embedded" && options.sponsor;
      return (await signers.signAndSendTransaction({ transaction, wallet, chain, options: { sponsor } })).signature;
    },
  };
}
