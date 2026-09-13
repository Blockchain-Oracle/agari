"use client";

import type { ParlayLegInput } from "@masayume/core/parlay";
import type { MarketId } from "@masayume/core/types";
import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { submitParlayOpen, type ParlayOpenOutcome } from "@masayume/markets/parlay";
import { invalidateAfterWrite, useSubmitter } from "@masayume/markets/react";
import { getClient } from "@masayume/markets/runtime";
import { resolveVaultDeployment, type VaultContracts } from "@masayume/markets/vault";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { PublicClient } from "viem";
import { diagnosisCopy } from "@/lib/copy";
import { webEnv } from "@/lib/env";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { useOwnerWalletClient } from "@/providers/UserSessionProvider";
import { PARLAY } from "./copy";

export type ParlayBusyKey = `open` | `claim:${string}` | `settle:${string}:${number}`;

/**
 * Every reserve write from the page: the open through its own lane (it hands back the ticket id and
 * a requote instead of a popup when the book moved), settlement and claim through the session's
 * queued lane. Every read the write can change is refetched afterwards.
 */
export function useParlayWrites() {
  const submitter = useSubmitter();
  const walletClient = useOwnerWalletClient();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<ParlayBusyKey | null>(null);

  const contracts = useCallback((): VaultContracts | null => {
    if (!walletClient) return null;
    return { walletClient, publicClient: getClient().getViemClient() as PublicClient, deployment: resolveVaultDeployment(webEnv.markets) };
  }, [walletClient]);

  const settle = useCallback(async () => {
    if (address) await invalidateAfterWrite(queryClient, { wallet: address });
  }, [address, queryClient]);

  const open = useCallback(
    async (legs: ParlayLegInput[], maxPayoutBase: bigint, maxStakeBase: bigint): Promise<ParlayOpenOutcome | null> => {
      if (!submitter || !address) return null;
      const c = contracts();
      if (!c) return null;
      setBusy("open");
      try {
        return await submitParlayOpen({ journal: submitter.journal, wallet: address, contracts: c }, { kind: "parlay-open", legs, maxPayoutBase, maxStakeBase });
      } finally {
        setBusy(null);
        await settle();
      }
    },
    [submitter, address, contracts, settle],
  );

  const claim = useCallback(
    async (parlayId: bigint, payoutBase: bigint, decimals: number, symbol: string): Promise<void> => {
      if (!submitter) return;
      setBusy(`claim:${parlayId}`);
      try {
        const outcome = await submitter.submitTx({ kind: "parlay-claim", parlayId });
        if (outcome.status === "confirmed") notify.neutral(PARLAY.slip.claimed(formatBaseUnits(payoutBase, decimals), symbol, shortHex(outcome.txHash, 8, 0)));
        else notify.warning(diagnosisCopy(outcome.diagnosis.kind).headline, diagnosisCopy(outcome.diagnosis.kind).body);
      } finally {
        setBusy(null);
        await settle();
      }
    },
    [submitter, settle],
  );

  const settleLeg = useCallback(
    async (parlayId: bigint, legIdx: number, marketId: MarketId): Promise<void> => {
      if (!submitter) return;
      setBusy(`settle:${parlayId}:${legIdx}`);
      try {
        const outcome = await submitter.submitTx({ kind: "parlay-resolve-leg", parlayId, legIdx, marketId });
        if (outcome.status === "confirmed") notify.neutral(PARLAY.slip.settled);
        else notify.warning(diagnosisCopy(outcome.diagnosis.kind).headline, diagnosisCopy(outcome.diagnosis.kind).body);
      } finally {
        setBusy(null);
        await settle();
      }
    },
    [submitter, settle],
  );

  return { open, claim, settleLeg, busy, address, canSign: Boolean(submitter && walletClient) };
}
