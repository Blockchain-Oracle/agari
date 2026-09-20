"use client";

import type { MarketId, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import type { LeverageOpenOutcome } from "@agari/markets/leverage";
import { invalidateAfterWrite, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { recordBet } from "@/features/room/record-bet";
import { useCallback, useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useOwnerWallet, useWalletSession } from "@/lib/wallet-session";
import { LEVERAGE } from "./copy";

export type LeverageBusyKey = "open" | `close:${string}` | `settle:${string}` | `knock:${string}` | `claim:${string}`;

export interface LeverageOpenInput {
  marketId: MarketId;
  side: Side;
  stakeBase: bigint;
  leverageBps: number;
  /** The owner's guard: fewer contracts than this and the open is refused rather than filled worse. */
  minQuantityRaw: bigint;
}

/**
 * Every reserve write from a surface: the open through its own lane (it hands back the position and a
 * requote instead of a popup when the book moved), the cash-out, the settlement and the knock-out through
 * the session's queued lane. Every read the write can change is refetched afterwards.
 */
export function useLeverageWrites() {
  const submitter = useSubmitter();
  const wallet = useOwnerWallet();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<LeverageBusyKey | null>(null);

  const refresh = useCallback(
    async (marketId?: MarketId) => {
      if (address) await invalidateAfterWrite(queryClient, { wallet: address, ...(marketId ? { marketId } : {}) });
    },
    [address, queryClient],
  );

  const open = useCallback(
    async (input: LeverageOpenInput): Promise<LeverageOpenOutcome | null> => {
      if (!submitter || !address) return null;
      setBusy("open");
      try {
        const outcome = await submitter.submitLeverageOpen({ kind: "leverage-open", ...input });
        // The reserve holds the contracts, so the wallet never shows a position: the registry is the Room's only way to know.
        if (outcome.status === "confirmed") recordBet(input.marketId, address, outcome.txHash, "leverage");
        return outcome;
      } finally {
        setBusy(null);
        await refresh(input.marketId);
      }
    },
    [submitter, address, refresh],
  );

  const warn = (outcome: { status: string; diagnosis?: { kind: Parameters<typeof diagnosisCopy>[0]; technical: string } }) => {
    const copy = outcome.diagnosis ? diagnosisCopy(outcome.diagnosis.kind) : null;
    if (copy) notify.warning(copy.headline, outcome.diagnosis?.technical || copy.body);
  };

  const close = useCallback(
    async (positionId: bigint, marketId: MarketId, minProceedsBase: bigint, decimals: number, symbol: string): Promise<void> => {
      if (!submitter) return;
      setBusy(`close:${positionId}`);
      try {
        const outcome = await submitter.submitTx({ kind: "leverage-close", positionId, marketId, minProceedsBase });
        if (outcome.status === "confirmed") notify.neutral(LEVERAGE.bets.cashedOut(formatBaseUnits(minProceedsBase, decimals), symbol));
        else warn(outcome);
      } finally {
        setBusy(null);
        await refresh(marketId);
      }
    },
    [submitter, refresh],
  );

  const settle = useCallback(
    async (positionId: bigint, marketId: MarketId): Promise<void> => {
      if (!submitter) return;
      setBusy(`settle:${positionId}`);
      try {
        const outcome = await submitter.submitTx({ kind: "leverage-settle", positionId, marketId });
        if (outcome.status === "confirmed") notify.neutral(LEVERAGE.bets.settledToast);
        else warn(outcome);
      } finally {
        setBusy(null);
        await refresh(marketId);
      }
    },
    [submitter, refresh],
  );

  const knockOut = useCallback(
    async (positionId: bigint, marketId: MarketId): Promise<void> => {
      if (!submitter) return;
      setBusy(`knock:${positionId}`);
      try {
        const outcome = await submitter.submitTx({ kind: "leverage-knock-out", positionId, marketId });
        if (outcome.status !== "confirmed") warn(outcome);
      } finally {
        setBusy(null);
        await refresh(marketId);
      }
    },
    [submitter, refresh],
  );

  const claim = useCallback(
    async (positionId: bigint, marketId: MarketId, owedBase: bigint, decimals: number, symbol: string): Promise<void> => {
      if (!submitter) return;
      setBusy(`claim:${positionId}`);
      try {
        const outcome = await submitter.submitTx({ kind: "leverage-claim", positionId });
        if (outcome.status === "confirmed") notify.neutral(LEVERAGE.bets.claimedToast(formatBaseUnits(owedBase, decimals), symbol));
        else warn(outcome);
      } finally {
        setBusy(null);
        await refresh(marketId);
      }
    },
    [submitter, refresh],
  );

  return { open, close, settle, knockOut, claim, busy, address, canSign: Boolean(submitter && wallet) };
}
