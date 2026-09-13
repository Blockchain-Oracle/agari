"use client";

import { mark } from "@masayume/markets/perf";
import { SubmitterSessionProvider } from "@masayume/markets/react";
import { createContext, useContext, type ReactNode } from "react";
import type { WalletClient } from "viem";
import { useWalletClient } from "wagmi";
import { webEnv } from "@/lib/env";
import { useWalletSession } from "@/lib/wallet-session";

const OwnerWalletClientContext = createContext<WalletClient | null>(null);

/**
 * Hands wagmi's wallet client to a signing session — and only while the wallet is on Somnia
 * Shannon, so a wrong-chain wallet can never sign a venue write.
 *
 * This replaces the old global `bindSigner` handoff. The difference that matters: switching
 * account or chain disposes the session rather than swapping a signer inside a shared object,
 * so authority ends when the session ends.
 *
 * The raw wallet client is also published for the one write that is not a venue or vault call:
 * the owner moving STT to a session key. The transfer itself lives in packages/markets.
 */
export function UserSessionProvider({ children }: { children: ReactNode }) {
  const { data: walletClient } = useWalletClient();
  const { isRightChain, isConnecting } = useWalletSession();
  // Settled either way: a wallet that reconnected and a browser with no wallet at all are both
  // "known", and only the unresolved middle is worth waiting on.
  if (!isConnecting) mark("wallet.ready");

  return (
    <OwnerWalletClientContext.Provider value={isRightChain && walletClient ? (walletClient as WalletClient) : null}>
      <SubmitterSessionProvider env={webEnv.markets} walletClient={walletClient} enabled={isRightChain}>
        {children}
      </SubmitterSessionProvider>
    </OwnerWalletClientContext.Provider>
  );
}

/** The connected owner's wallet client on the right chain, or null. */
export function useOwnerWalletClient(): WalletClient | null {
  return useContext(OwnerWalletClientContext);
}
