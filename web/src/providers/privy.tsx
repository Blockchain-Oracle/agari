"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import {
  toSolanaWalletConnectors,
  useSignAndSendTransaction,
  useSignMessage,
  useSignTransaction,
  useWallets,
} from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { useEffect, useMemo } from "react";
import { BRAND } from "@/lib/copy";
import { PRIVY_SOLANA_CHAIN, SOLANA_RPC_URL, SOLANA_WS_URL } from "./solana-client";
import { activeWallet, embeddedSolanaAddress, toWalletSession, type PrivySigners } from "./wallet/privy-session";
import type { WalletShellState } from "./wallet/wallet-shell-context";

/** What the island hands back to the shell once Privy is ready. */
export interface IslandHandle {
  login(): void;
  logout(): Promise<void>;
}

interface IslandProps {
  appId: string;
  onState(state: Omit<WalletShellState, "hydrated">): void;
  onReady(handle: IslandHandle): void;
}

/**
 * Privy's theme API takes a literal hex, and component code never hard-codes one (AD-12): read the brand accent from the
 * resolved `--vermilion` token. The island is client-only, so the document exists; anything that isn't a hex is left out.
 */
function accentColor(): `#${string}` | undefined {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--vermilion").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? (value as `#${string}`) : undefined;
}

/** Created once per island load; `solana.rpcs` is what Privy's embedded-wallet UIs simulate and send with. */
const solanaRpcs = {
  [PRIVY_SOLANA_CHAIN]: {
    rpc: createSolanaRpc(SOLANA_RPC_URL),
    rpcSubscriptions: createSolanaRpcSubscriptions(SOLANA_WS_URL),
  },
};

/**
 * The Privy island (D-017), loaded lazily by `WalletShellProvider`. Solana-only: social login creates an embedded
 * Solana wallet for users without one; Phantom, Backpack and Solflare connect through Privy's Wallet Standard
 * connectors. Login methods themselves are the Privy dashboard's (no `loginMethods` override), so enabling Google or
 * X there needs no deploy.
 */
export function PrivyIsland({ appId, onState, onReady }: IslandProps) {
  const connectors = useMemo(() => toSolanaWalletConnectors(), []);
  const accent = useMemo(accentColor, []);
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: { walletChainType: "solana-only", theme: "dark", accentColor: accent, landingHeader: `Sign in to ${BRAND.name}` },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
        externalWallets: { solana: { connectors } },
        solana: { rpcs: solanaRpcs },
      }}
    >
      <PrivyBridge onState={onState} onReady={onReady} />
    </PrivyProvider>
  );
}

/** Reads Privy's hooks and publishes the shell state; renders nothing. */
function PrivyBridge({ onState, onReady }: Omit<IslandProps, "appId">) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const { signTransaction } = useSignTransaction();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  useEffect(() => {
    if (ready) onReady({ login: () => login(), logout });
  }, [ready, login, logout, onReady]);

  const embedded = embeddedSolanaAddress(user?.linkedAccounts as Parameters<typeof embeddedSolanaAddress>[0]);
  const active = authenticated ? activeWallet(wallets) : null;

  useEffect(() => {
    if (!ready || !walletsReady) {
      onState({ status: "restoring", authenticated: false, address: null, kind: null, wallet: null });
      return;
    }
    if (!active) {
      onState({ status: "ready", authenticated, address: null, kind: null, wallet: null });
      return;
    }
    const kind = active.wallet.address === embedded ? "embedded" : "external";
    const signers: PrivySigners = { signMessage, signTransaction, signAndSendTransaction };
    const wallet = toWalletSession(active.wallet, active.address, kind, signers, PRIVY_SOLANA_CHAIN);
    onState({ status: "ready", authenticated, address: active.address, kind, wallet });
    // `active` is rebuilt each render; its wallet object and address are what identify the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, walletsReady, authenticated, active?.wallet, active?.address, embedded, signMessage, signTransaction, signAndSendTransaction, onState]);

  return null;
}
