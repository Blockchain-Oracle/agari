"use client";

import { chainReconciler, recoverUnresolved, type RecoveryResult, type SubmitterSession } from "@masayume/markets";
import { useEffect } from "react";
import { RECOVERY } from "@/features/recovery/copy";
import { notify } from "@/lib/toast";
import { useSessionKey } from "./SessionKeyProvider";

const asked = new WeakSet<SubmitterSession>();

function announce(results: RecoveryResult[]): void {
  for (const { record, outcome } of results) {
    if (outcome === "landed") notify.neutral(RECOVERY.landed(record.summary).title, RECOVERY.landed(record.summary).description);
    else if (outcome === "absent") notify.warning(RECOVERY.absent(record.summary).title, RECOVERY.absent(record.summary).description);
    else if (outcome === "reverted") notify.warning(RECOVERY.reverted(record.summary).title, RECOVERY.reverted(record.summary).description);
    else if (outcome === "expired") notify.warning(RECOVERY.expired(record.summary).title, RECOVERY.expired(record.summary).description);
  }
}

/** The key's journal is reconciled the same way the wallet's is: once per key session, nothing re-sent (AD-3). */
export function SessionRecovery() {
  const { session } = useSessionKey();
  useEffect(() => {
    if (!session || asked.has(session)) return;
    asked.add(session);
    let cancelled = false;
    recoverUnresolved(session.submitter.journal, session.address, chainReconciler, Date.now())
      .then((results) => !cancelled && announce(results))
      .catch((error: unknown) => console.warn("[session recovery] journal read failed:", error));
    return () => {
      cancelled = true;
    };
  }, [session]);
  return null;
}
