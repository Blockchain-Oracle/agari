"use client";

import type { Address } from "@masayume/core/types";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { WalletClient } from "viem";
import type { MarketsEnv } from "../env";
import { createSubmitterSession, type SubmitterSession } from "../sessions";
import { nowMs } from "../provider/clock";
import { createLocalStorageJournal } from "../submitter/journal-local-storage";
import type { MarketsSubmitter } from "../submitter/create";

const SessionContext = createContext<SubmitterSession | null>(null);

export interface SubmitterSessionProviderProps {
  env: MarketsEnv;
  /** The connected wallet client, or undefined when there is nothing to sign with. */
  walletClient: WalletClient | undefined;
  /** Gate the session on anything the app requires before signing is safe — the right chain, for example. */
  enabled?: boolean;
  children: ReactNode;
}

/**
 * Owns the user's signing session for the lifetime of one connected account.
 *
 * A new wallet client — connect, account switch, chain switch, disconnect — disposes the old
 * session and builds a new one. Nothing is rebound in place, so an in-flight write can never
 * find a different signer than the one it started with, and a stale session cannot sign after
 * the authority behind it is gone.
 */
export function SubmitterSessionProvider({ env, walletClient, enabled = true, children }: SubmitterSessionProviderProps) {
  const [session, setSession] = useState<SubmitterSession | null>(null);

  useEffect(() => {
    if (!walletClient || !enabled) {
      setSession(null);
      return;
    }

    let cancelled = false;
    let created: SubmitterSession | null = null;

    void createSubmitterSession({
      env,
      authority: "user-wallet",
      signer: { walletClient },
      journal: createLocalStorageJournal(nowMs),
      nowMs,
    })
      .then((next) => {
        created = next;
        // The effect was superseded while we were constructing: dispose rather than publish,
        // otherwise a switched-away account keeps a live signer.
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
  }, [env, walletClient, enabled]);

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

/** The account that will actually sign — the session's, not wagmi's; the two differ while a session is being built. */
export function useSigner(): SignerState {
  const session = useUserSession();
  return { address: session?.address ?? null, hasSigner: session !== null };
}
