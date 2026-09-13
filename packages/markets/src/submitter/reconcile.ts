import type { IntentRecord } from "@masayume/core/ports";
import type { Address } from "@masayume/core/types";
import { msToSec } from "@masayume/core/units";
import { getClient } from "../runtime/read-runtime";

export type ReconcileVerdict = "confirmed" | "reverted" | "absent" | "unknown";

const FILLS_PAGE = 20;

/**
 * A send that timed out with no digest is never auto-retried: the chain is asked what happened first (AD-3).
 * With a digest the receipt decides — success or revert; without one, only an order can be reconciled
 * (through its fills on the pool it was aimed at).
 */
export async function reconcileUnknown(wallet: Address, record: IntentRecord, pool?: Address): Promise<ReconcileVerdict> {
  const client = getClient();
  if (record.txHash) {
    const receipt = await client.getViemClient().getTransactionReceipt({ hash: record.txHash }).catch(() => null);
    if (!receipt) return "unknown";
    return receipt.status === "reverted" ? "reverted" : "confirmed";
  }
  const at = pool ?? record.pool;
  if (record.kind !== "order" || !at) return "unknown";

  const since = msToSec(record.createdAtMs);
  const [fills, openOrderIds] = await Promise.all([
    client.getUserFills(wallet, { pool: at, since, limit: FILLS_PAGE }),
    client.getOwnOpenOrdersOnchain(at, wallet),
  ]);
  if (fills.length > 0) return "confirmed";
  // Resting orders may predate this intent, so they are evidence of nothing either way.
  return openOrderIds.length > 0 ? "unknown" : "absent";
}
