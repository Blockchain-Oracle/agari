"use client";

import type { RangeSide } from "@agari/core/range";
import type { MarketId } from "@agari/core/types";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import type { RangeOpenOutcome } from "@agari/markets/range";
import { invalidateAfterWrite, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useOwnerWallet, useWalletSession } from "@/lib/wallet-session";
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
  const wallet = useOwnerWallet();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<RangeBusyKey | null>(null);

  const refresh = useCallback(async () => {
    if (address) await invalidateAfterWrite(queryClient, { wallet: address });
  }, [address, queryClient]);

  const open = useCallback(
    async (input: RangeOpenInput): Promise<RangeOpenOutcome | null> => {
      // A submitter exists only because a session bound a signer, so there is no separate "is a wallet connected"
      // question here; the range open needs no vault deployment of its own — the reserve is its own custody.
      if (!submitter || !address || !wallet) return null;
      setBusy("open");
      try {
        // The submitter owns the session signer, so the open goes through the same lane as every other write.
        return await submitter.submitRangeOpen({ kind: "range-open", ...input });
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [submitter, address, wallet, refresh],
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

  return { open, claim, settle, voidStale, busy, address, canSign: Boolean(submitter && wallet) };
}
