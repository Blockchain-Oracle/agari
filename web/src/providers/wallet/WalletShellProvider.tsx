"use client";

import { isAddress, type Address } from "@agari/core/types";
import type { WalletSession as MarketsWalletSession } from "@agari/markets/react";
import { useConnectedWallet, useDisconnect, useWalletStatus } from "@solana/kit-plugin-wallet/react";
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AccountModal } from "./AccountModal";
import { walletClient } from "./kit-wallet";
import { WalletPicker } from "./WalletPicker";
import { WalletShellContext, type WalletShell } from "./wallet-shell-context";

const subscribeNothing = () => () => undefined;

/**
 * Owns the wallet connection (D-023). State comes from the Kit wallet plugin's `useSyncExternalStore` hooks. Their
 * server snapshot is `pending`, but on the client they hand hydration the live store, which has usually settled on
 * `disconnected` a microtask after it was created. That hydrated the header's inert "Connect" with its live props
 * and React kept the server's `invisible` class. So nothing counts as settled until hydration is over, which is the
 * role RainbowKit's `mounted` flag played in Masayume.
 */
export function WalletShellProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const liveStatus = useWalletStatus(walletClient);
  const liveConnected = useConnectedWallet(walletClient);
  const status = hydrated ? liveStatus : "pending";
  const connected = hydrated ? liveConnected : null;
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
      status: status === "pending" || status === "reconnecting" ? "restoring" : "ready",
      connecting: status === "connecting",
      address,
      wallet,
      openPicker,
      openAccount,
      disconnect,
    }),
    [status, address, wallet, openPicker, openAccount, disconnect],
  );

  return (
    <WalletShellContext.Provider value={value}>
      {children}
      <WalletPicker open={pickerOpen} onOpenChange={setPickerOpen} />
      <AccountModal open={accountOpen} onOpenChange={setAccountOpen} address={address} onDisconnect={disconnect} />
    </WalletShellContext.Provider>
  );
}
