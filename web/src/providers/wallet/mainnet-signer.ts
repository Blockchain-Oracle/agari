"use client";

import type { Address } from "@agari/core/types";
import type { TransactionSigner } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { createSignerFromWalletAccount } from "@solana/wallet-account-signer";
import { useMemo } from "react";
import { walletClient } from "./kit-wallet";
import { useWalletShell } from "./wallet-shell-context";

/**
 * The connected wallet account re-wrapped for `solana:mainnet` (D-126): the desk is real money on another cluster
 * than the app's read runtime, so its owner calls sign with a signer bound to mainnet and send through the app's own
 * `/api/rpc/mainnet`. The app's wallet client is filtered on the app's cluster (devnet on a dev deployment); a
 * Wallet Standard account lists every chain it will sign for, so mainnet is asked of the account itself, and an
 * account that does not offer it says why instead of failing at the first popup.
 *
 * Lives in `providers/wallet`, the one web island allowed to import `@solana/*` (kit-import-boundary).
 */
export const MAINNET_CHAIN = "solana:mainnet";
export const MAINNET_RPC_PATH = "/api/rpc/mainnet";

export type MainnetWalletSession =
  | { kind: "ready"; address: Address; signer: TransactionSigner; rpcUrl: string }
  | { kind: "restoring" }
  | { kind: "no-wallet" }
  | { kind: "unsupported"; address: Address; why: string };

export function useMainnetWalletSession(): MainnetWalletSession {
  const shell = useWalletShell();
  const connected = useConnectedWallet(walletClient);
  const address = shell.status === "ready" ? shell.address : null;
  const account = address !== null && connected?.account.address === address ? connected.account : null;
  const walletName = connected?.wallet.name ?? "This wallet";
  return useMemo<MainnetWalletSession>(() => {
    if (shell.status === "restoring") return { kind: "restoring" };
    if (address === null || account === null) return { kind: "no-wallet" };
    if (!account.chains.includes(MAINNET_CHAIN)) return { kind: "unsupported", address, why: `${walletName} did not offer Solana mainnet for this account. Switch it to mainnet and reconnect.` };
    try {
      return { kind: "ready", address, signer: createSignerFromWalletAccount(account, MAINNET_CHAIN), rpcUrl: MAINNET_RPC_PATH };
    } catch (error) {
      return { kind: "unsupported", address, why: `${walletName} cannot sign mainnet transactions for this account: ${error instanceof Error ? error.message : "no signing feature"}` };
    }
  }, [shell.status, address, account, walletName]);
}
