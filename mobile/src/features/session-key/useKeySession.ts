import type { VaultDeployment } from "@agari/core/vault";
import { createLocalStorageJournal, createSponsorTransport, createSubmitterSession, nowMs, type SubmitterSession } from "@agari/markets";
import { useEffect, useState } from "react";
import type { StoredSessionKey } from "@/features/session/store";
import { marketsEnv } from "~/lib/env";
import { deviceId, SPONSOR_ENDPOINT } from "./sponsor";

interface KeySessionInput {
  armed: boolean;
  sessionKey: StoredSessionKey | null;
  deployment: VaultDeployment | null;
  sponsorConfigured: boolean;
}

/** One writer per key: the phone runs one JS thread, so the sends are chained here (web takes a browser-wide lock). */
function serialised(session: SubmitterSession): SubmitterSession {
  let tail: Promise<unknown> = Promise.resolve();
  const queue = <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task, task);
    tail = next.catch(() => undefined);
    return next;
  };
  const { submitter } = session;
  return {
    ...session,
    get disposed() {
      return session.disposed;
    },
    submitter: {
      ...submitter,
      submitOrder: (request, onPhase) => queue(() => submitter.submitOrder(request, onPhase)),
      submitTx: (intent, onPhase) => queue(() => submitter.submitTx(intent, onPhase)),
      submitCashOut: (request, onPhase) => queue(() => submitter.submitCashOut(request, onPhase)),
    },
  };
}

/**
 * web's useKeySession on the phone: the key's own signing session, alive only while the grant is live and this phone
 * holds the key (imported non-extractable from the Keychain seed). While a sponsor is configured it co-signs through
 * `/api/sponsor` (the fee-payer slot only); a refusal is kept so the manager can say why the key paid instead.
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
    const sponsor = sponsorConfigured ? createSponsorTransport({ endpoint: SPONSOR_ENDPOINT, device: deviceId() }) : null;
    setRefusal(() => () => sponsor?.lastRefusal() ?? null);
    void createSubmitterSession({ env: marketsEnv, authority: "session-key", signer: { keyPair: sessionKey.keyPair }, journal: createLocalStorageJournal(nowMs), nowMs, ...(sponsor ? { sponsor } : {}) })
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
