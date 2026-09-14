"use client";

import type { Address } from "@agari/core/types";
import type { WalletSession as MarketsWalletSession } from "@agari/markets/react";
import { createContext, useContext } from "react";

/**
 * The wallet shell's state, with no Privy import: every consumer (header, tickets, `useWalletSession`) reads this,
 * so the Privy island can load late (or never) without a single consumer changing or a hydration mismatch.
 *
 * - `unavailable`: no Privy app id is configured; sign-in says so instead of opening a broken modal.
 * - `idle`: the island isn't loaded and there is no remembered session; nothing is known to be connected.
 * - `restoring`: a remembered session is being reloaded; surfaces hold their control inert rather than flash "Connect".
 * - `ready`: Privy is loaded; `authenticated` and `wallet` are authoritative.
 */
export type WalletShellStatus = "unavailable" | "idle" | "restoring" | "ready";

export interface WalletShellState {
  status: WalletShellStatus;
  /** False on the server and the first client render, so both render the same inert control. */
  hydrated: boolean;
  authenticated: boolean;
  address: Address | null;
  kind: "embedded" | "external" | null;
  /** The D-014 seam handed to markets: present only for an authenticated user with a usable Solana wallet. */
  wallet: MarketsWalletSession | null;
}

export interface WalletShellActions {
  /** Opens Privy's sign-in (social login or an external Solana wallet), loading the island first if needed. */
  login(): void;
  logout(): Promise<void>;
  /** Warms the island's chunk on hover or focus, so the click that follows opens the modal at once. */
  prefetch(): void;
}

export type WalletShell = WalletShellState & WalletShellActions;

export const DISCONNECTED: WalletShellState = {
  status: "idle",
  hydrated: false,
  authenticated: false,
  address: null,
  kind: null,
  wallet: null,
};

const noop = () => undefined;

export const WalletShellContext = createContext<WalletShell>({
  ...DISCONNECTED,
  login: noop,
  logout: async () => undefined,
  prefetch: noop,
});

export function useWalletShell(): WalletShell {
  return useContext(WalletShellContext);
}
