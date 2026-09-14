import type { Signature } from "@agari/core/types";
import type { Base64EncodedWireTransaction, Signature as KitSignature } from "@solana/kit";
import { chainFailure } from "../chain-failure";
import type { ChainFailure } from "../errors";
import type { WriteRpc } from "./message";
import { resendStep } from "./send";

export type Landing =
  | { kind: "landed"; slot: bigint }
  | { kind: "landed-failed"; slot: bigint; failure: ChainFailure }
  /** No status by the blockhash's last valid height (`expired`) or the lane's cap: recovery decides (AD-3). */
  | { kind: "unknown"; reason: "expired" | "cap" };

export interface ConfirmInput {
  signature: Signature;
  /** The signed bytes to re-send; absent when a sending-only wallet broadcast them. */
  wire?: Base64EncodedWireTransaction;
  lastValidBlockHeight: bigint;
  capMs?: number;
  pollMs?: number;
  resendMs?: number;
  /** Check the block height every n-th empty poll; each check is one more RPC call on a per-IP budget. */
  heightEvery?: number;
}

export const CONFIRM_CAP_MS = 90_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Whether a status has reached `confirmed` (or `finalized`). Exported for reconcile. */
export function isConfirmed(status: { confirmationStatus: string | null } | null): boolean {
  return status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized";
}

/**
 * Polls `getSignatureStatuses` every 1.5 s, re-sending the same bytes every 2 s, until the transaction is confirmed
 * (ok or failed), the block height passes `lastValidBlockHeight`, or 90 s pass (first-call.md §3.1).
 */
export async function confirmStep(rpc: WriteRpc, input: ConfirmInput): Promise<Landing> {
  const { signature, wire, lastValidBlockHeight } = input;
  const capMs = input.capMs ?? CONFIRM_CAP_MS;
  const pollMs = input.pollMs ?? 1_500;
  const resendMs = input.resendMs ?? 2_000;
  const heightEvery = input.heightEvery ?? 3;
  const startedAt = Date.now();
  let landed = false;
  const resender = wire ? setInterval(() => void (landed || resendStep(rpc, wire)), resendMs) : null;
  let emptyPolls = 0;
  try {
    for (;;) {
      await sleep(pollMs);
      // A failed poll (429, dropped socket) is no answer: the loop keeps asking until the cap.
      const status = await rpc
        .getSignatureStatuses([signature as string as KitSignature])
        .send()
        .then(({ value }) => value[0] ?? null, () => undefined);
      if (status) landed = true;
      if (status && isConfirmed(status)) {
        return status.err ? { kind: "landed-failed", slot: status.slot, failure: chainFailure(status.err, null) } : { kind: "landed", slot: status.slot };
      }
      if (Date.now() - startedAt >= capMs) return { kind: "unknown", reason: "cap" };
      if (status !== null) continue;
      emptyPolls += 1;
      if (emptyPolls % heightEvery === 0) {
        const height = await rpc.getBlockHeight({ commitment: "confirmed" }).send().catch(() => null);
        if (height !== null && height > lastValidBlockHeight) return { kind: "unknown", reason: "expired" };
      }
    }
  } finally {
    if (resender) clearInterval(resender);
  }
}
