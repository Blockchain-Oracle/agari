"use client";

import type { Address } from "@agari/core/types";
import type { VaultDeployment } from "@agari/core/vault";
import { createLocalStorageJournal, createSponsorTransport, createSubmitterSession, nowMs, type SubmitterSession } from "@agari/markets";
import { useEffect, useState } from "react";
import { webEnv } from "@/lib/env";
import { deviceId, type StoredSessionKey } from "./store";
import { SPONSOR_ENDPOINT } from "./useSponsorStatus";

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
 * of those disposes it; nothing is rebound in place. While a sponsor is configured the session co-signs through
 * `/api/sponsor` (tap-trading.md §3): the server signs the fee-payer slot only, markets journals and sends. A refusal
 * is kept so the manager can say why the key paid instead.
 */
export function useKeySession({ armed, sessionKey, deployment, sponsorConfigured }: KeySessionInput): { session: SubmitterSession | null; sponsorRefusal: () => string | null } {
  const [session, setSession] = useState<SubmitterSession | null>(null);
  const [refusal, setRefusal] = useState<() => string | null>(() => noRefusal);

  useEffect(() => {
    if (!armed || !sessionKey || !deployment) {
      setSession(null);
      return;
    }
    let cancelled = false;
    let created: SubmitterSession | null = null;
    // One transport per session: it dies with the key's authority, never outliving a revoke or a re-key.
    const sponsor = sponsorConfigured ? createSponsorTransport({ endpoint: SPONSOR_ENDPOINT, device: deviceId() }) : null;
    setRefusal(() => () => sponsor?.lastRefusal() ?? null);
    // The non-extractable pair signs through Kit's createSignerFromKeyPair inside markets (D-066).
    void createSubmitterSession({ env: webEnv.markets, authority: "session-key", signer: { keyPair: sessionKey.keyPair }, journal: createLocalStorageJournal(nowMs), nowMs, ...(sponsor ? { sponsor } : {}) })
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
      setRefusal(() => noRefusal);
      void created?.dispose();
    };
  }, [armed, sessionKey, deployment, sponsorConfigured]);

  return { session, sponsorRefusal: refusal };
}

const noRefusal = (): string | null => null;
