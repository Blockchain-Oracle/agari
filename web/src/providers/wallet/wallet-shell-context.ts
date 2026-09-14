"use client";

import type { Address } from "@agari/core/types";
import type { WalletSession as MarketsWalletSession } from "@agari/markets/react";
import { createContext, useContext } from "react";

/**
 * The wallet shell's state as every consumer (header, tickets, `useWalletSession`) reads it, with no wallet SDK import,
 * so only `web/src/providers` touches `@solana/*`.
 *
 * - `restoring`: before hydration, or while the last wallet silently reconnects; controls stay inert rather than flash "Connect".
 * - `ready`: discovery has settled; `address` and `wallet` are authoritative.
 */
export type WalletShellStatus = "restoring" | "ready";

export interface WalletShellState {
  status: WalletShellStatus;
  /** A user-initiated connection is in flight (the picker shows it). */
  connecting: boolean;
  address: Address | null;
  /** The D-014 seam handed to markets: present only while a wallet account that can sign is connected. */
  wallet: MarketsWalletSession | null;
}

export interface WalletShellActions {
  /** Opens the connect modal. */
  openPicker(): void;
  /** Opens the account modal for the connected wallet (Masayume's RainbowKit `openAccountModal`). */
  openAccount(): void;
  disconnect(): Promise<void>;
}

export type WalletShell = WalletShellState & WalletShellActions;

export const DISCONNECTED: WalletShellState = { status: "restoring", connecting: false, address: null, wallet: null };

export const WalletShellContext = createContext<WalletShell>({
  ...DISCONNECTED,
  openPicker: () => undefined,
  openAccount: () => undefined,
  disconnect: async () => undefined,
});

export function useWalletShell(): WalletShell {
  return useContext(WalletShellContext);
}
