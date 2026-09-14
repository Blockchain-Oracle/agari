"use client";

import type { Address } from "@agari/core/types";
import type { VaultDeployment } from "@agari/core/vault";
import { createLocalStorageJournal, createSubmitterSession, nowMs, parseSecretKey, type SubmitterSession } from "@agari/markets";
import { useEffect, useState } from "react";
import { webEnv } from "@/lib/env";

interface KeySessionInput {
  armed: boolean;
  /** base58 of the key's 64-byte secret key. */
  secretKey: string | null;
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
    },
  };
}

/**
 * The key's own signing session, alive only while the grant is live and this browser holds the key. A change to any
 * of those disposes it; nothing is rebound in place. The fee-payer co-sign that lets a sponsor pay the key's fees is
 * the vault stage's (S7); until then the key pays its own, so there is never a sponsor refusal to report.
 */
export function useKeySession({ armed, secretKey, deployment }: KeySessionInput): { session: SubmitterSession | null; sponsorRefusal: () => string | null } {
  const [session, setSession] = useState<SubmitterSession | null>(null);

  useEffect(() => {
    if (!armed || !secretKey || !deployment) {
      setSession(null);
      return;
    }
    let cancelled = false;
    let created: SubmitterSession | null = null;
    let bytes: Uint8Array;
    try {
      bytes = parseSecretKey(secretKey);
    } catch {
      setSession(null);
      return;
    }
    void createSubmitterSession({ env: webEnv.markets, authority: "session-key", signer: { secretKey: bytes }, journal: createLocalStorageJournal(nowMs), nowMs })
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
  }, [armed, secretKey, deployment]);

  return { session, sponsorRefusal: noRefusal };
}

const noRefusal = (): string | null => null;
