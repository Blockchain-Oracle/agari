"use client";

import type { MarketId } from "@agari/core/types";
import { invalidateAfterWrite, useSigner, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { diagnosisCopy, PREOPEN, SUBMITTED_UNKNOWN } from "@/lib/copy";

export interface CancelState {
  busy: boolean;
  /** What happened, in a sentence: the refund, or why the cancel did not land. */
  note: string | null;
  done: boolean;
}

export type CancelHandle = { node: number; seq: bigint };

const IDLE: CancelState = { busy: false, note: null, done: false };

/**
 * Cancels the wallet's own resting calls on one Window (D-088): `user_cancel_orders` through the tx lane, escrow back
 * to the seat's venue credit (no withdraw — the credit funds the next call first). A second tap while one is in flight
 * is absorbed. Confirmed, the wallet's positions and resting rows are refreshed together.
 */
export function useCancelResting() {
  const submitter = useSubmitter();
  const { address } = useSigner();
  const queryClient = useQueryClient();
  const [state, setState] = useState<CancelState>(IDLE);
  const inFlight = useRef(false);

  const cancel = useCallback(
    async (marketId: MarketId, handles: CancelHandle[]) => {
      if (inFlight.current || !submitter || !address) return;
      inFlight.current = true;
      setState({ busy: true, note: null, done: false });
      try {
        const outcome = await submitter.submitTx({ kind: "cancel-orders", marketId, handles, withdraw: false });
        if (outcome.status === "confirmed") {
          await invalidateAfterWrite(queryClient, { wallet: address, marketId });
          setState({ busy: false, note: PREOPEN.receipt.cancelled, done: true });
          return;
        }
        if (outcome.status === "unknown") {
          setState({ busy: false, note: SUBMITTED_UNKNOWN, done: false });
          return;
        }
        setState({ busy: false, note: outcome.diagnosis.technical || diagnosisCopy(outcome.diagnosis.kind).body, done: false });
      } finally {
        inFlight.current = false;
      }
    },
    [address, queryClient, submitter],
  );

  const reset = useCallback(() => setState(IDLE), []);
  return { ...state, canSign: submitter !== null && address !== null, cancel, reset };
}
