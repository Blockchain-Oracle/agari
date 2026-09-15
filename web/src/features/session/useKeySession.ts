"use client";

import type { Address } from "@agari/core/types";
import type { VaultDeployment } from "@agari/core/vault";
import { createLocalStorageJournal, createSubmitterSession, nowMs, type SubmitterSession } from "@agari/markets";
import { useEffect, useState } from "react";
import { webEnv } from "@/lib/env";
import { keySessionWallet } from "./key-signer";
import type { StoredSessionKey } from "./store";

interface KeySessionInput {
  armed: boolean;
  /** This browser's key for the owner: the non-extractable pair from IndexedDB (record v2). */
  sessionKey: StoredSessionKey | null;
  deployment: VaultDeployment | null;
  sponsorConfigured: boolean;
}

/** One key, one writer, even across tabs: every send waits for the browser-wide lock on the key's address. */
function withKeyLock<T>(key: Address, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return task();
  return locks.request(`agari.sessionKey.${key}`, task) as Promise<T>;
}

function serialised(session: SubmitterSession): SubmitterSession {
  const { submitter } = session;
  return {
    ...session,
    get disposed() {
      return session.disposed;
    },
    submitter: {
      ...submitter,
      submitOrder: (request, onPhase) => withKeyLock(session.address, () => submitter.submitOrder(request, onPhase)),
      submitTx: (intent, onPhase) => withKeyLock(session.address, () => submitter.submitTx(intent, onPhase)),
      submitCashOut: (request, onPhase) => withKeyLock(session.address, () => submitter.submitCashOut(request, onPhase)),
    },
  };
}

/**
 * The key's own signing session, alive only while the grant is live and this browser holds the key. A change to any
 * of those disposes it; nothing is rebound in place. The fee-payer co-sign transport (`/api/sponsor`) joins the
 * session when lane 7b's adapter accepts one; until then the key pays its own fee, so there is no refusal to report.
 */
export function useKeySession({ armed, sessionKey, deployment }: KeySessionInput): { session: SubmitterSession | null; sponsorRefusal: () => string | null } {
  const [session, setSession] = useState<SubmitterSession | null>(null);

  useEffect(() => {
    if (!armed || !sessionKey || !deployment) {
      setSession(null);
      return;
    }
    let cancelled = false;
    let created: SubmitterSession | null = null;
    const wallet = keySessionWallet(sessionKey);
    void createSubmitterSession({ env: webEnv.markets, authority: "session-key", signer: { wallet }, journal: createLocalStorageJournal(nowMs), nowMs })
      .then((next) => {
        created = next;
        if (cancelled) return next.dispose();
        setSession(serialised(next));
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
  }, [armed, sessionKey, deployment]);

  return { session, sponsorRefusal: noRefusal };
}

const noRefusal = (): string | null => null;
