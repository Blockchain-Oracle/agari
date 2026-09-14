"use client";

import { useConnect, useWallets } from "@solana/kit-plugin-wallet/react";
import { useCallback, useMemo, useState } from "react";
import { KNOWN_WALLETS, type KnownWallet } from "./copy";
import { walletClient } from "./kit-wallet";

export type DiscoveredWallet = ReturnType<typeof useWallets>[number];
export type ConnectOutcome = "connected" | "failed" | "aborted";

/** RainbowKit's `rk-recent` for this app: the last wallet that connected, kept across a disconnect so it can say "Recent". */
const RECENT_KEY = "agari.wallet.recent";

function readRecent(): string | null {
  try {
    return window.localStorage.getItem(RECENT_KEY);
  } catch {
    return null;
  }
}

function writeRecent(name: string): void {
  try {
    window.localStorage.setItem(RECENT_KEY, name);
  } catch {
    // Blocked storage only costs the "Recent" tag.
  }
}

export interface WalletChoices {
  /** Wallet Standard wallets in this browser for the app's chain, the recent one first (RainbowKit's "Installed"). */
  installed: ReadonlyArray<{ wallet: DiscoveredWallet; recent: boolean }>;
  /** Phantom, Solflare and Backpack when this browser doesn't have them (Masayume's "Browser" group), even while discovery is still settling, so the modal never opens empty. */
  browser: readonly KnownWallet[];
  connect(wallet: DiscoveredWallet): Promise<ConnectOutcome>;
}

/** The connect modal's data: the Kit wallet plugin's discovery and connect (D-023), shaped as RainbowKit listed wallets. */
export function useWalletChoices(): WalletChoices {
  const wallets = useWallets(walletClient);
  const { dispatchAsync } = useConnect(walletClient);
  const [recent, setRecent] = useState<string | null>(readRecent);

  const installed = useMemo(
    () =>
      wallets
        .map((wallet) => ({ wallet, recent: wallet.name === recent }))
        .sort((a, b) => Number(b.recent) - Number(a.recent)),
    [wallets, recent],
  );

  const browser = useMemo(() => {
    const present = new Set(wallets.map((wallet) => wallet.name.toLowerCase()));
    return KNOWN_WALLETS.filter((known) => !present.has(known.name.toLowerCase()));
  }, [wallets]);

  const connect = useCallback(
    async (wallet: DiscoveredWallet): Promise<ConnectOutcome> => {
      try {
        await dispatchAsync(wallet);
        writeRecent(wallet.name);
        setRecent(wallet.name);
        return "connected";
      } catch (error) {
        return (error as Error).name === "AbortError" ? "aborted" : "failed";
      }
    },
    [dispatchAsync],
  );

  return { installed, browser, connect };
}
