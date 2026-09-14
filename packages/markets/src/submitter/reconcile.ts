import type { IntentRecord } from "@agari/core/ports";
import type { Address } from "@agari/core/types";

export type ReconcileVerdict = "confirmed" | "reverted" | "absent" | "unknown";

/**
 * A send that timed out is never auto-retried: the chain is asked what happened first (AD-3). With a signature the
 * transaction status decides; without one, an order is reconciled through the Window's fills. That needs the RPC
 * client and the indexer (S4), so until then every open record stays "unknown" and is left untouched.
 */
export async function reconcileUnknown(_wallet: Address, _record: IntentRecord, _pool?: Address): Promise<ReconcileVerdict> {
  return "unknown";
}
