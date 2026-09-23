import { connectLinkWallet, linkWalletSession, practiceWalletSession, type LinkWalletState } from "@agari/markets/sessions/mobile";
import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { WalletShellContext, type WalletShell, type WalletShellState } from "@/providers/wallet/wallet-shell-context";
import { marketsEnv, SITE_URL } from "~/lib/env";
import { storage } from "~/lib/storage";
import type { WalletKind } from "./choices";
import { clearLinkState, loadLinkState, saveLinkState } from "./link-store";
import { isWalletInstalled, linkPort } from "./link-port";
import { practiceSeed } from "./practice-store";
import { clearMwaState, connectMwaWallet, loadMwaState, mwaWalletSession } from "./mwa";

const STORE_URL = Platform.select({
  android: { phantom: "https://play.google.com/store/apps/details?id=app.phantom", solflare: "https://play.google.com/store/apps/details?id=com.solflare.mobile" },
  default: { phantom: "https://apps.apple.com/app/phantom-crypto-wallet/id1598432977", solflare: "https://apps.apple.com/app/solflare-solana-wallet/id1580902717" },
})!;

/** Thrown when the chosen wallet app is not on this phone; the sheet offers its download. */
export class WalletNotInstalledError extends Error {
  constructor(readonly storeUrl: string) {
    super("not installed");
  }
}

/** Web's remembered-wallet key (providers/wallet/kit-wallet.ts storageKey). */
const REMEMBERED = "agari.wallet";

/** The app-only half of the shell: connect a specific wallet (the connect sheet's rows call it). */
const ConnectContext = createContext<(kind: WalletKind) => Promise<void>>(async () => undefined);
export const useConnectWallet = () => useContext(ConnectContext);

const READY_EMPTY: WalletShellState = { status: "ready", connecting: false, address: null, wallet: null };

/**
 * The app's wallet shell: fills web's own WalletShellContext, so every web hook that reads the wallet
 * (useWalletSession, useOwnerWallet, the faucet, claims, signed texts, UserSessionProvider) runs unchanged.
 */
/** A wallet's session: the practice key, or a link wallet (connecting it, or restoring its stored session silently). */
async function openWallet(kind: WalletKind, restore: boolean) {
  if (kind === "practice") return practiceWalletSession(await practiceSeed(), marketsEnv);
  if (kind === "mwa") {
    const state = restore ? await loadMwaState() : await connectMwaWallet();
    if (!state) throw new Error("No Android wallet session is stored.");
    return mwaWalletSession(state);
  }
  let state: LinkWalletState | null = await loadLinkState();
  if (state?.wallet !== kind) {
    if (restore) throw new Error("no stored session");
    if (!(await isWalletInstalled(kind))) throw new WalletNotInstalledError(STORE_URL[kind]);
    state = await connectLinkWallet(kind, linkPort, SITE_URL, "devnet");
    await saveLinkState(state);
  }
  return linkWalletSession(state, linkPort);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletShellState>(() => (storage.getString(REMEMBERED) ? { ...READY_EMPTY, status: "restoring" } : READY_EMPTY));

  const connectKind = useCallback(async (kind: WalletKind) => {
    setState((s) => ({ ...s, connecting: true }));
    try {
      const wallet = await openWallet(kind, false);
      storage.set(REMEMBERED, kind);
      setState({ status: "ready", connecting: false, address: wallet.address, wallet });
    } catch (error) {
      setState((s) => ({ ...s, status: "ready", connecting: false }));
      throw error;
    }
  }, []);

  // Restore a remembered practice wallet silently, as web's plugin reconnects a remembered wallet.
  useEffect(() => {
    const remembered = storage.getString(REMEMBERED) as WalletKind | undefined;
    if (!remembered) return;
    openWallet(remembered, true).then(
      (wallet) => setState({ status: "ready", connecting: false, address: wallet.address, wallet }),
      () => {
        storage.remove(REMEMBERED);
        setState(READY_EMPTY);
      },
    );
  }, [connectKind]);

  const shell = useMemo<WalletShell>(
    () => ({
      ...state,
      openPicker: () => router.push("/connect"),
      openAccount: () => router.push("/account"),
      disconnect: async () => {
        storage.remove(REMEMBERED);
        await clearLinkState();
        await clearMwaState();
        setState(READY_EMPTY);
      },
    }),
    [state, connectKind],
  );

  return (
    <WalletShellContext.Provider value={shell}>
      <ConnectContext.Provider value={connectKind}>{children}</ConnectContext.Provider>
    </WalletShellContext.Provider>
  );
}
