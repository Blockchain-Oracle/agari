"use client";

import { messageBytes } from "@agari/core/auth";
import { encodeBase58, toSignature, type Address, type Signature } from "@agari/core/types";
import type { WalletSession as MarketsWalletSession } from "@agari/markets/react";
import { useWalletShell } from "@/providers/wallet/wallet-shell-context";

export interface WalletSession {
  address: Address | null;
  isConnected: boolean;
  /** Before hydration, or while the last wallet silently reconnects: controls stay inert rather than flash "Connect". */
  isConnecting: boolean;
  /**
   * Always equal to `isConnected` on Solana. The cluster is the app's, not the wallet's: nothing in a Solana wallet can
   * sit on the "wrong chain" for a signature, so there is no switch to offer (the EVM-era `switchToShannon` is gone).
   */
  isRightChain: boolean;
  /** Kept for the surfaces that disable a control while a switch runs; there is never a switch on Solana. */
  switching: false;
  /** A user-initiated connection is in flight. */
  connecting: boolean;
  /** Opens the connect modal (Wallet Standard wallets installed in this browser, D-023). */
  connect(): void;
  /** Opens the account modal (avatar, address, Copy Address, Disconnect): Masayume's RainbowKit `openAccountModal`. */
  openAccount(): void;
  disconnect(): Promise<void>;
}

/** The sole wallet surface in product code: session only, never chain reads (AD-14). Base58 is case-sensitive: never re-case `address`. */
export function useWalletSession(): WalletSession {
  const shell = useWalletShell();
  const isConnected = shell.status === "ready" && shell.address !== null && shell.wallet !== null;
  return {
    address: isConnected ? shell.address : null,
    isConnected,
    isConnecting: shell.status === "restoring",
    isRightChain: isConnected,
    switching: false,
    connecting: shell.connecting,
    connect: shell.openPicker,
    openAccount: shell.openAccount,
    disconnect: shell.disconnect,
  };
}

/** The connected owner's wallet (the D-014 seam), or null: what owner-signed flows (session-key funding, signed texts) use. */
export function useOwnerWallet(): MarketsWalletSession | null {
  const shell = useWalletShell();
  return shell.status === "ready" ? shell.wallet : null;
}

/**
 * Signs one of Agari's texts (`@agari/core` builders: faucet, X link, duel room, private desk) and returns the base58
 * signature the server verifies with `verifySignedMessage`. The wallet signs exactly the UTF-8 bytes (D-012).
 */
export async function signText(wallet: MarketsWalletSession, text: string): Promise<Signature> {
  return toSignature(encodeBase58(await wallet.signMessage(messageBytes(text))));
}
