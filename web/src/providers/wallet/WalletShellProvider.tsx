"use client";

import { isAddress, type Address } from "@agari/core/types";
import type { WalletSession as MarketsWalletSession } from "@agari/markets/react";
import { useConnectedWallet, useDisconnect, useWalletStatus } from "@solana/kit-plugin-wallet/react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { walletClient } from "./kit-wallet";
import { WalletPicker } from "./WalletPicker";
import { WalletShellContext, type WalletShell } from "./wallet-shell-context";

/**
 * Owns the wallet connection (D-023). State comes from the Kit wallet plugin's `useSyncExternalStore` hooks, whose
 * server snapshot is `pending`, so the server and the first client render agree on an inert control.
 */
export function WalletShellProvider({ children }: { children: ReactNode }) {
  const status = useWalletStatus(walletClient);
  const connected = useConnectedWallet(walletClient);
  const { dispatchAsync: disconnectWallet } = useDisconnect(walletClient);
  const [pickerOpen, setPickerOpen] = useState(false);

  const rawAddress = connected?.account.address ?? null;
  const address: Address | null = rawAddress !== null && isAddress(rawAddress) ? rawAddress : null;
  const signer = connected?.signer ?? null;

  const wallet = useMemo<MarketsWalletSession | null>(() => {
    if (address === null || signer === null) return null;
    return { address, signer, signMessage: (message) => walletClient.wallet.signMessage(message) };
  }, [address, signer]);

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const disconnect = useCallback(async () => {
    try {
      await disconnectWallet();
    } catch (error) {
      if ((error as Error).name !== "AbortError") throw error;
    }
  }, [disconnectWallet]);

  const value = useMemo<WalletShell>(
    () => ({
      status: status === "pending" || status === "reconnecting" ? "restoring" : "ready",
      connecting: status === "connecting",
      address,
      wallet,
      openPicker,
      disconnect,
    }),
    [status, address, wallet, openPicker, disconnect],
  );

  return (
    <WalletShellContext.Provider value={value}>
      {children}
      <WalletPicker open={pickerOpen} onOpenChange={setPickerOpen} />
    </WalletShellContext.Provider>
  );
}
