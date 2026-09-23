import { recoverUnresolved, type RecoveryResult, type SubmitterSession } from "@agari/markets";
import { useUserSession } from "@agari/markets/react";
import { useEffect } from "react";
import { RECOVERY } from "@/features/recovery/copy";
import { pushToast } from "~/components/toast/store";

const asked = new WeakSet<SubmitterSession>();

/** One toast per outcome, in web's words; still-pending sends are counted into one line. */
export function announceRecovery(results: readonly RecoveryResult[]): void {
  let pending = 0;
  for (const { record, outcome } of results) {
    const copy =
      outcome === "landed" ? RECOVERY.landed(record.summary)
      : outcome === "absent" ? RECOVERY.absent(record.summary)
      : outcome === "reverted" ? RECOVERY.reverted(record.summary)
      : outcome === "expired" ? RECOVERY.expired(record.summary)
      : null;
    if (outcome === "pending") pending += 1;
    if (copy) pushToast({ title: copy.title, description: copy.description, tone: outcome === "landed" ? "neutral" : "warning" });
  }
  if (pending > 0) pushToast({ title: RECOVERY.pending(pending).title, description: RECOVERY.pending(pending).description, tone: "neutral" });
}

/**
 * web's features/recovery/WriteRecovery.tsx: once per signing session, ask the chain about every write the journal
 * still holds open and say what it found. Nothing is re-sent (AD-3). Renders nothing; mounted in the root layout.
 */
export function WriteRecovery() {
  const session = useUserSession();
  useEffect(() => {
    if (!session || asked.has(session)) return;
    asked.add(session);
    let cancelled = false;
    recoverUnresolved(session.submitter.journal, session.address, session.submitter.reconciler, Date.now())
      .then((results) => {
        if (!cancelled) announceRecovery(results);
      })
      .catch((error: unknown) => console.warn("[recovery] journal read failed:", error));
    return () => {
      cancelled = true;
    };
  }, [session]);
  return null;
}
