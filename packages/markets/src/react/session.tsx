"use client";

import type { Address } from "@agari/core/types";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MarketsEnv } from "../env";
import { nowMs } from "../provider/clock";
import { createSubmitterSession, type SubmitterSession } from "../sessions";
import type { MarketsSubmitter } from "../submitter/create";
import { createLocalStorageJournal } from "../submitter/journal-local-storage";
import type { WalletSession } from "./wallet-session";

const SessionContext = createContext<SubmitterSession | null>(null);

export interface SubmitterSessionProviderProps {
  env: MarketsEnv;
  /** The connected wallet through the byte-level seam (D-014), or undefined when there is nothing to sign with. */
  wallet: WalletSession | undefined;
  /** Gate the session on anything the app requires before signing is safe. */
  enabled?: boolean;
  children: ReactNode;
}

/**
 * Owns the user's signing session for the lifetime of one connected account.
 *
 * A new wallet (connect, account switch, disconnect) disposes the old session and builds a new one. Nothing is
 * rebound in place, so an in-flight write can never find a different signer than the one it started with, and a
 * stale session can't sign after the authority behind it is gone. Keyed on the address: the wallet shell can hand back
 * a fresh session object on re-render, and a re-render must not churn the session.
 */
export function SubmitterSessionProvider({ env, wallet, enabled = true, children }: SubmitterSessionProviderProps) {
  const [session, setSession] = useState<SubmitterSession | null>(null);
  const address = wallet?.address ?? null;

  useEffect(() => {
    if (!wallet || !enabled) {
      setSession(null);
      return;
    }

    let cancelled = false;
    let created: SubmitterSession | null = null;

    void createSubmitterSession({ env, authority: "user-wallet", signer: { wallet }, journal: createLocalStorageJournal(nowMs), nowMs })
      .then((next) => {
        created = next;
        // Superseded while constructing: dispose rather than publish, or a switched-away account keeps a live signer.
        if (cancelled) return next.dispose();
        setSession(next);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });

    return () => {
      cancelled = true;
      setSession(null);
      void created?.dispose();
    };
    // The wallet object's identity is not its authority; the address is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env, address, enabled]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/** The active signing session, or null when nothing can sign. */
export function useUserSession(): SubmitterSession | null {
  return useContext(SessionContext);
}

/** The session's write pipeline, or null when there is no session to write through. */
export function useSubmitter(): MarketsSubmitter | null {
  return useUserSession()?.submitter ?? null;
}

export interface SignerState {
  address: Address | null;
  hasSigner: boolean;
}

/** The account that will actually sign — the session's, not the wallet UI's; the two differ while a session is being built. */
export function useSigner(): SignerState {
  const session = useUserSession();
  return { address: session?.address ?? null, hasSigner: session !== null };
}
