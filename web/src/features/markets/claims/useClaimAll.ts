"use client";

import type { TxOutcome } from "@masayume/core/ports";
import { diagnosis, type ClaimableRow, type Diagnosis } from "@masayume/core/types";
import { diagnose, marketsProvider, nowMs, unwrap, type MarketsSubmitter } from "@masayume/markets";
import { invalidateAfterWrite, useSigner, useSubmitter } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { IDLE_RUN, itemsFromRows } from "./claim-run";
import type { ClaimItem, ClaimRun } from "./types";

interface StepResult {
  patch: Partial<ClaimItem>;
  /** A refusal or an unresolved send stops the batch: one signing key is one writer, and a cancelled user is not re-prompted. */
  stop: boolean;
}

function stopWith(diag: Diagnosis, patch: Partial<ClaimItem> = {}): StepResult {
  return { patch: { status: "pending", diagnosis: diag, ...patch }, stop: true };
}

function fromOutcome(outcome: TxOutcome): StepResult {
  switch (outcome.status) {
    case "confirmed":
      return { patch: { status: "confirmed", txHash: outcome.txHash, diagnosis: null }, stop: false };
    case "reverted":
      return { patch: { status: "reverted", txHash: outcome.txHash ?? null, diagnosis: outcome.diagnosis }, stop: false };
    case "unknown":
      return { patch: { status: "unknown", txHash: outcome.txHash ?? null, diagnosis: outcome.diagnosis }, stop: true };
    case "refused":
      return stopWith(outcome.diagnosis);
  }
}

/** One leg: gate on the head-fresh chain view (canon #1), then redeem with its explicit outcomeIdx (canon #11). */
export async function redeemOne(submitter: MarketsSubmitter, item: ClaimItem): Promise<StepResult> {
  let outcomeToken;
  try {
    const onchain = unwrap(await marketsProvider.getOnchain(item.marketId));
    if (!onchain.isResolved && !onchain.isVoided) return stopWith(diagnosis("not-settled", `${item.marketId} has no settlement on chain yet`));
    outcomeToken = onchain.outcomeToken;
  } catch (error) {
    return stopWith(diagnose(error));
  }
  const outcome = await submitter.submitTx({
    kind: "redeem",
    marketId: item.marketId,
    outcomeIdx: item.outcomeIdx,
    amountRaw: item.amountRaw,
    marketAddress: item.marketAddress,
    outcomeToken,
  });
  return fromOutcome(outcome);
}

/**
 * Claim-all on wallet gas: one signature per redemption, per-item outcomes, never one collapsed verdict (AD-15).
 * The sum the plate shows comes from the claimables reading, whose fee the port read at read time; the Epic 8
 * relayer re-reads settlementFeeBps at execution and must keep this surface's per-item contract unchanged.
 */
export function useClaimAll() {
  const submitter = useSubmitter();
  const { address, hasSigner } = useSigner();
  const queryClient = useQueryClient();
  const [run, setRun] = useState<ClaimRun>(IDLE_RUN);
  const inFlight = useRef(false);

  const patchItem = useCallback((key: string, patch: Partial<ClaimItem>) => {
    setRun((current) => ({ ...current, items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) }));
  }, []);

  const claimAll = useCallback(
    async (rows: readonly ClaimableRow[]) => {
      const items = itemsFromRows(rows);
      if (!submitter || !address || inFlight.current || items.length === 0) return;
      inFlight.current = true;
      setRun({ status: "running", items, diagnosis: null, gasShort: false, finishedAtMs: null });

      // Gas is checked once before the first popup so an empty STT tank never strands a half-signed batch (FR-2).
      const gas = await submitter.checkGas("redeem");
      if (!gas.ok) {
        setRun((current) => ({ ...current, status: "done", diagnosis: gas.diagnosis, gasShort: gas.diagnosis.kind === "out-of-gas", finishedAtMs: nowMs() }));
        inFlight.current = false;
        return;
      }

      for (const item of items) {
        patchItem(item.key, { status: "claiming" });
        const result = await redeemOne(submitter, item);
        patchItem(item.key, result.patch);
        if (result.patch.status === "confirmed") await invalidateAfterWrite(queryClient, { wallet: address, marketId: item.marketId });
        if (result.stop) {
          setRun((current) => ({ ...current, diagnosis: result.patch.diagnosis ?? null }));
          break;
        }
      }
      setRun((current) => ({ ...current, status: "done", finishedAtMs: nowMs() }));
      inFlight.current = false;
    },
    [address, patchItem, queryClient, submitter],
  );

  const reset = useCallback(() => setRun(IDLE_RUN), []);

  return { run, claimAll, reset, hasSigner };
}
