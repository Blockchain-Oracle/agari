"use client";

import type { PhaseListener, TxOutcome, VaultIntent, WritePhase } from "@masayume/core/ports";
import type { Diagnosis, Hex } from "@masayume/core/types";
import { invalidateAfterWrite, useSigner, useSubmitter } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { VAULT } from "./copy";

export type VaultWriteKind = VaultIntent["kind"];

export interface VaultWriteState {
  /** The intent in flight, so each control can say "Depositing" while the others wait. */
  busy: VaultWriteKind | null;
  phase: WritePhase;
  txHash: Hex | null;
  diagnosis: Diagnosis | null;
  gasShort: boolean;
}

const IDLE: VaultWriteState = { busy: null, phase: "composing", txHash: null, diagnosis: null, gasShort: false };

function phaseOf(outcome: TxOutcome): WritePhase {
  if (outcome.status === "confirmed") return "confirmed";
  if (outcome.status === "reverted") return "reverted";
  if (outcome.status === "unknown") return "unknown";
  return "composing";
}

/**
 * One vault write at a time through the session's second lane (AD-3): gas is checked before any
 * popup, the outcome is reported per the colour law (a record is neutral, degraded truth is a
 * warning), and every read the write can change is refetched afterwards. Nothing is re-sent.
 */
export function useVaultWrite() {
  const submitter = useSubmitter();
  const { address, hasSigner } = useSigner();
  const queryClient = useQueryClient();
  const [state, setState] = useState<VaultWriteState>(IDLE);
  const inFlight = useRef(false);

  const run = useCallback(
    async (intent: VaultIntent, landed: string): Promise<TxOutcome | null> => {
      if (!submitter || !address || inFlight.current) return null;
      inFlight.current = true;
      setState({ busy: intent.kind, phase: "submitted", txHash: null, diagnosis: null, gasShort: false });

      const gas = await submitter.checkGas("vault");
      if (!gas.ok) {
        setState({ ...IDLE, diagnosis: gas.diagnosis, gasShort: gas.diagnosis.kind === "out-of-gas" });
        notify.warning(diagnosisCopy(gas.diagnosis.kind).headline, diagnosisCopy(gas.diagnosis.kind).body);
        inFlight.current = false;
        return { status: "refused", diagnosis: gas.diagnosis };
      }

      const onPhase: PhaseListener = (phase, detail) => setState((s) => ({ ...s, phase, txHash: detail?.txHash ?? s.txHash }));
      const outcome = await submitter.submitTx(intent, onPhase);
      if (outcome.status === "confirmed") {
        notify.neutral(landed);
        await invalidateAfterWrite(queryClient, { wallet: address, ...("marketId" in intent ? { marketId: intent.marketId } : {}) });
      } else if (outcome.status === "unknown") {
        notify.warning(diagnosisCopy(outcome.diagnosis.kind).headline, VAULT.toasts.unknown);
      } else {
        notify.warning(diagnosisCopy(outcome.diagnosis.kind).headline, diagnosisCopy(outcome.diagnosis.kind).body);
      }
      setState({
        busy: null,
        phase: phaseOf(outcome),
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
