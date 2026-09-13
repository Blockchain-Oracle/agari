"use client";

import type { Address, Hex } from "@masayume/core/types";
import type { VaultDeployment } from "@masayume/core/vault";
import { createLocalStorageJournal, createSessionKeySession, createSponsorTransport, nowMs, sessionKeyClient, type SubmitterSession } from "@masayume/markets";
import { useEffect, useState } from "react";
import { webEnv } from "@/lib/env";
import { deviceId } from "./store";
import { SPONSOR_ENDPOINT } from "./useSponsorStatus";

interface KeySessionInput {
  armed: boolean;
  privateKey: Hex | null;
  deployment: VaultDeployment | null;
  sponsorConfigured: boolean;
}

/** One key, one writer, even across tabs: every send waits for the browser-wide lock on the key's address. */
function withKeyLock<T>(key: Address, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return task();
  return locks.request(`masayume.sessionKey.${key.toLowerCase()}`, task) as Promise<T>;
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
 * The key's own signing session, alive only while the grant is live and this browser holds the
 * key. A change to any of those disposes it; nothing is rebound in place.
 */
export function useKeySession({ armed, privateKey, deployment, sponsorConfigured }: KeySessionInput): { session: SubmitterSession | null; sponsorRefusal: () => string | null } {
  const [session, setSession] = useState<SubmitterSession | null>(null);
  const [refusal, setRefusal] = useState<() => string | null>(() => () => null);

  useEffect(() => {
    if (!armed || !privateKey || !deployment) {
      setSession(null);
      return;
    }
    let cancelled = false;
    let created: SubmitterSession | null = null;
    const env = webEnv.markets;
    const sponsor = sponsorConfigured
      ? createSponsorTransport({
          endpoint: SPONSOR_ENDPOINT,
          forwarder: deployment.forwarder,
          walletClient: sessionKeyClient(privateKey, env),
          deviceId: deviceId(),
          nowSec: () => Math.floor(nowMs() / 1000),
        })
      : undefined;
    setRefusal(() => () => sponsor?.lastRefusal() ?? null);
    void createSessionKeySession({ env, privateKey, journal: createLocalStorageJournal(nowMs), nowMs, ...(sponsor ? { sponsor } : {}) })
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
  }, [armed, privateKey, deployment, sponsorConfigured]);

  return { session, sponsorRefusal: refusal };
}
