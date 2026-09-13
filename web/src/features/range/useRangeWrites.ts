"use client";

import type { RangeSide } from "@masayume/core/range";
import type { MarketId } from "@masayume/core/types";
import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { submitRangeOpen, type RangeOpenOutcome } from "@masayume/markets/range";
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
import { RANGE } from "./copy";

export type RangeBusyKey = "open" | `claim:${string}` | `settle:${string}` | `void:${string}`;

export interface RangeOpenInput {
  marketId: MarketId;
  asset: string;
  side: RangeSide;
  lowPrint: bigint;
  highPrint: bigint;
  maxPayoutBase: bigint;
  maxStakeBase: bigint;
}

/**
 * Every reserve write from a surface: the open through its own lane (it hands back the round id and a
 * requote instead of a popup when the basis moved), settlement, the stale void and the claim through the
 * session's queued lane. Every read the write can change is refetched afterwards.
 */
export function useRangeWrites() {
  const submitter = useSubmitter();
  const walletClient = useOwnerWalletClient();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<RangeBusyKey | null>(null);

  const contracts = useCallback((): VaultContracts | null => {
    if (!walletClient) return null;
    return { walletClient, publicClient: getClient().getViemClient() as PublicClient, deployment: resolveVaultDeployment(webEnv.markets) };
  }, [walletClient]);

  const refresh = useCallback(async () => {
    if (address) await invalidateAfterWrite(queryClient, { wallet: address });
  }, [address, queryClient]);

  const open = useCallback(
    async (input: RangeOpenInput): Promise<RangeOpenOutcome | null> => {
      if (!submitter || !address) return null;
      const c = contracts();
      if (!c) return null;
      setBusy("open");
      try {
        return await submitRangeOpen({ journal: submitter.journal, wallet: address, contracts: c }, { kind: "range-open", ...input });
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [submitter, address, contracts, refresh],
  );

  const claim = useCallback(
    async (roundId: bigint, payoutBase: bigint, decimals: number, symbol: string): Promise<void> => {
      if (!submitter) return;
      setBusy(`claim:${roundId}`);
      try {
        const outcome = await submitter.submitTx({ kind: "range-claim", roundId });
        if (outcome.status === "confirmed") notify.neutral(RANGE.slip.claimed(formatBaseUnits(payoutBase, decimals), symbol, shortHex(outcome.txHash, 8, 0)));
        else notify.warning(diagnosisCopy(outcome.diagnosis.kind).headline, diagnosisCopy(outcome.diagnosis.kind).body);
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [submitter, refresh],
  );

  const settle = useCallback(
    async (roundId: bigint, marketId: MarketId): Promise<void> => {
      if (!submitter) return;
      setBusy(`settle:${roundId}`);
      try {
        const outcome = await submitter.submitTx({ kind: "range-settle", roundId, marketId });
        if (outcome.status === "confirmed") notify.neutral(RANGE.slip.settled);
        else notify.warning(diagnosisCopy(outcome.diagnosis.kind).headline, diagnosisCopy(outcome.diagnosis.kind).body);
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [submitter, refresh],
  );

  const voidStale = useCallback(
    async (roundId: bigint): Promise<void> => {
      if (!submitter) return;
      setBusy(`void:${roundId}`);
      try {
        const outcome = await submitter.submitTx({ kind: "range-void-stale", roundId });
        if (outcome.status === "confirmed") notify.neutral(RANGE.slip.voidedToast);
        else notify.warning(diagnosisCopy(outcome.diagnosis.kind).headline, diagnosisCopy(outcome.diagnosis.kind).body);
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [submitter, refresh],
  );

  return { open, claim, settle, voidStale, busy, address, canSign: Boolean(submitter && walletClient) };
}
