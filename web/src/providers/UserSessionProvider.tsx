"use client";

import { mark } from "@agari/markets/perf";
import { SubmitterSessionProvider } from "@agari/markets/react";
import type { ReactNode } from "react";
import { webEnv } from "@/lib/env";
import { useOwnerWallet, useWalletSession } from "@/lib/wallet-session";

/**
 * Hands the connected Privy wallet (the D-014 seam) to a signing session, and only while a user is signed in with a
 * usable Solana wallet.
 *
 * Switching account or logging out disposes the session rather than swapping a signer inside a shared object, so
 * authority ends when the session ends. Owner-signed flows outside the venue (session-key funding, signed texts)
 * read the same wallet through `useOwnerWallet`.
 */
export function UserSessionProvider({ children }: { children: ReactNode }) {
  const wallet = useOwnerWallet();
  const { isConnected, isConnecting } = useWalletSession();
  // Settled either way: a restored session and a browser with no wallet at all are both "known";
  // only the unresolved middle is worth waiting on.
  if (!isConnecting) mark("wallet.ready");

  return (
    <SubmitterSessionProvider env={webEnv.markets} wallet={wallet ?? undefined} enabled={isConnected}>
      {children}
    </SubmitterSessionProvider>
  );
}

export { useOwnerWallet } from "@/lib/wallet-session";
