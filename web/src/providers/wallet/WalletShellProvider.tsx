"use client";

import { isAddress, type Address } from "@agari/core/types";
import type { WalletSession as MarketsWalletSession } from "@agari/markets/react";
import { useConnectedWallet, useDisconnect, useWalletStatus } from "@solana/kit-plugin-wallet/react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AccountModal } from "./AccountModal";
import { WALLET_STORAGE_KEY, walletClient } from "./kit-wallet";
import { WalletPicker } from "./WalletPicker";
import { WalletShellContext, type WalletShell } from "./wallet-shell-context";

/** The plugin's own window for a remembered wallet to re-register before it gives up (its `statusTimeout`). */
const RESTORE_CAP_MS = 3_000;

const subscribeNothing = () => () => undefined;

function hasRememberedWallet(): boolean {
  try {
    return window.localStorage.getItem(WALLET_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Owns the wallet connection (D-023) from the Kit wallet plugin's `useSyncExternalStore` hooks.
 *
 * - **Server render and hydration:** the state is always "ready, disconnected", so "Connect" is in the first paint on
 *   both sides. The plugin's hooks hand hydration the live client store, and reading them there hydrated the header
 *   with mismatched attributes.
 * - **After hydration:** "restoring" means a remembered wallet (`agari.wallet`) is silently reconnecting, and never
 *   for longer than the plugin's own 3 s window. A browser with nothing remembered is ready at once, whatever the
 *   plugin's `pending` is doing, as wagmi's `isReconnecting` only ever was for a stored connection in Masayume.
 */
export function WalletShellProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const remembered = useSyncExternalStore(subscribeNothing, hasRememberedWallet, () => false);
  const liveStatus = useWalletStatus(walletClient);
  const liveConnected = useConnectedWallet(walletClient);
  const connected = hydrated ? liveConnected : null;
  const warmingUp = hydrated && remembered && (liveStatus === "pending" || liveStatus === "reconnecting");
  const [restoreExpired, setRestoreExpired] = useState(false);
  useEffect(() => {
    if (!warmingUp) return;
    const timer = setTimeout(() => setRestoreExpired(true), RESTORE_CAP_MS);
    return () => clearTimeout(timer);
  }, [warmingUp]);
  const restoring = warmingUp && !restoreExpired;
  const { dispatchAsync: disconnectWallet } = useDisconnect(walletClient);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const rawAddress = connected?.account.address ?? null;
  const address: Address | null = rawAddress !== null && isAddress(rawAddress) ? rawAddress : null;
  const signer = connected?.signer ?? null;

  const wallet = useMemo<MarketsWalletSession | null>(() => {
    if (address === null || signer === null) return null;
    return { address, signer, signMessage: (message) => walletClient.wallet.signMessage(message) };
  }, [address, signer]);

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const openAccount = useCallback(() => setAccountOpen(true), []);
  const disconnect = useCallback(async () => {
    try {
      await disconnectWallet();
    } catch (error) {
      if ((error as Error).name !== "AbortError") throw error;
    }
  }, [disconnectWallet]);

  const value = useMemo<WalletShell>(
    () => ({
      status: restoring ? "restoring" : "ready",
      connecting: hydrated && liveStatus === "connecting",
      address,
      wallet,
      openPicker,
      openAccount,
      disconnect,
    }),
    [restoring, hydrated, liveStatus, address, wallet, openPicker, openAccount, disconnect],
  );

  return (
    <WalletShellContext.Provider value={value}>
      {children}
      <WalletPicker open={pickerOpen} onOpenChange={setPickerOpen} />
      <AccountModal open={accountOpen} onOpenChange={setAccountOpen} address={address} onDisconnect={disconnect} />
    </WalletShellContext.Provider>
  );
}
