"use client";

import type { PhaseListener, TxOutcome, WritePhase } from "@masayume/core/ports";
import type { PrivateIntent } from "@masayume/core/private";
import type { Diagnosis, Hex } from "@masayume/core/types";
import { invalidateAfterWrite, useSigner, useSubmitter } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { PRIVATE } from "./copy";

export type PrivateWriteKind = PrivateIntent["kind"];

export interface PrivateWriteState {
  busy: PrivateWriteKind | null;
  phase: WritePhase;
  txHash: Hex | null;
  diagnosis: Diagnosis | null;
  gasShort: boolean;
}

const IDLE: PrivateWriteState = { busy: null, phase: "composing", txHash: null, diagnosis: null, gasShort: false };

/**
 * The owner's own writes against the desk — deposit-and-allow, withdraw, revoke, a permissionless settle —
 * one at a time through the session's tx lane: gas checked before any popup, the outcome told, every read
 * the write can change refetched. The desk's three-transaction open is never sent from here.
 */
export function usePrivateWrites() {
  const submitter = useSubmitter();
  const { address, hasSigner } = useSigner();
  const queryClient = useQueryClient();
  const [state, setState] = useState<PrivateWriteState>(IDLE);
  const inFlight = useRef(false);

  const run = useCallback(
    async (intent: PrivateIntent, landed: string | null): Promise<TxOutcome | null> => {
      if (!submitter || !address || inFlight.current) return null;
      inFlight.current = true;
      setState({ busy: intent.kind, phase: "submitted", txHash: null, diagnosis: null, gasShort: false });
      const gas = await submitter.checkGas("private");
      if (!gas.ok) {
        setState({ ...IDLE, diagnosis: gas.diagnosis, gasShort: gas.diagnosis.kind === "out-of-gas" });
        notify.warning(diagnosisCopy(gas.diagnosis.kind).headline, diagnosisCopy(gas.diagnosis.kind).body);
        inFlight.current = false;
        return { status: "refused", diagnosis: gas.diagnosis };
      }
      const onPhase: PhaseListener = (phase, detail) => setState((s) => ({ ...s, phase, txHash: detail?.txHash ?? s.txHash }));
      const outcome = await submitter.submitTx(intent, onPhase);
      if (outcome.status === "confirmed") {
        if (landed) notify.neutral(landed);
        await invalidateAfterWrite(queryClient, { wallet: address, ...("marketId" in intent ? { marketId: intent.marketId } : {}) });
      } else if (outcome.status === "unknown") {
        notify.warning(diagnosisCopy(outcome.diagnosis.kind).headline, PRIVATE.toasts.unknown);
      } else {
        notify.warning(diagnosisCopy(outcome.diagnosis.kind).headline, outcome.diagnosis.technical || diagnosisCopy(outcome.diagnosis.kind).body);
      }
      setState({
        busy: null,
        phase: outcome.status === "confirmed" ? "confirmed" : outcome.status === "reverted" ? "reverted" : outcome.status === "unknown" ? "unknown" : "composing",
        txHash: "txHash" in outcome ? (outcome.txHash ?? null) : null,
        diagnosis: outcome.status === "confirmed" ? null : outcome.diagnosis,
        gasShort: false,
      });
      inFlight.current = false;
      return outcome;
    },
    [address, queryClient, submitter],
  );

  return { state, run, hasSigner, address };
}
