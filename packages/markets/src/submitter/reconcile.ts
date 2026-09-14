import type { IntentRecord } from "@agari/core/ports";
import type { Address, MarketId } from "@agari/core/types";
import { msToSec } from "@agari/core/units";
import { findLedgerPda } from "@agari/clients/agari-events";
import type { Address as KitAddress, Signature as KitSignature } from "@solana/kit";
import type { WriteEvidence } from "./evidence";
import { isConfirmed } from "./steps/confirm";
import type { WriteRpc } from "./steps/message";

export type ReconcileVerdict = "confirmed" | "reverted" | "absent" | "unknown";

export interface ReconcileDeps {
  rpc: WriteRpc;
  evidence: WriteEvidence;
  nowMs: () => number;
}

/** A write closed before it had a signature may still have been sent by a sending-only wallet; after this, it can't land. */
export const UNSIGNED_SETTLE_MS = 120_000;

/** With a signature, the chain's status decides; past the blockhash's last valid height, no status means it never landed. */
async function bySignature(rpc: WriteRpc, record: IntentRecord & { txHash: NonNullable<IntentRecord["txHash"]> }): Promise<ReconcileVerdict> {
  const { value } = await rpc.getSignatureStatuses([record.txHash as string as KitSignature], { searchTransactionHistory: true }).send();
  const status = value[0] ?? null;
  if (status?.err) return "reverted";
  if (isConfirmed(status)) return "confirmed";
  if (status || record.lastValidBlockHeight === undefined) return "unknown";
  const height = await rpc.getBlockHeight({ commitment: "confirmed" }).send();
  return height > BigInt(record.lastValidBlockHeight) ? "absent" : "unknown";
}

/** Without a signature: an order is confirmed by any fill on its Window since it was recorded, a redeem by its `Redeemed`. */
async function byRecord(wallet: Address, record: IntentRecord, deps: ReconcileDeps): Promise<ReconcileVerdict> {
  if (deps.nowMs() - record.createdAtMs < UNSIGNED_SETTLE_MS || !record.marketId) return "unknown";
  if (record.kind === "order") {
    const filled = await deps.evidence.filledSince(wallet, record.marketId, msToSec(record.createdAtMs));
    return filled === null ? "unknown" : filled ? "confirmed" : "absent";
  }
  if (record.kind === "redeem") {
    const [ledger] = await findLedgerPda({ market: record.marketId as string as KitAddress });
    const paidBy = await deps.evidence.redeemedBy(wallet, record.marketId as MarketId, ledger as string as Address);
    // A crank that paid the seat is not this intent landing, but the claim it stood for is done either way.
    return paidBy ? "confirmed" : "absent";
  }
  return "unknown";
}

/**
 * A send that timed out, or a tab closed mid-send, is never re-signed or re-sent (AD-3): the chain and the index are
 * asked what happened (first-call.md §3.4, D-033).
 */
export async function reconcileUnknown(wallet: Address, record: IntentRecord, deps: ReconcileDeps): Promise<ReconcileVerdict> {
  if (record.txHash) return bySignature(deps.rpc, { ...record, txHash: record.txHash });
  return byRecord(wallet, record, deps);
}
