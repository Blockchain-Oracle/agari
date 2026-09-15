"use client";

import { isOk } from "@agari/core/schemas";
import type { OrderRoute } from "@agari/core/ports";
import type { Diagnosis, ExitQuote, MarketId, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { marketsProvider } from "@agari/markets";
import { invalidateAfterWrite, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";

/** The plain cash-out's words (L-35): the link is `LeverageBetRow`'s, the refusals are the plan's (`00-plan.md:1001`). */
export const CASH_OUT = {
  cashOut: "Cash out",
  cashingOut: "Cashing out…",
  noLiquidity: "No exit liquidity right now",
  locked: "No exit liquidity: this Window has locked, it pays at settlement",
  notLive: "Cash-out isn't live on this network yet",
  nothingSold: "Nothing sold: the book moved before the sell landed. Your position is unchanged.",
  requote: (floor: string) => `The book moved: the exit now pays at least ${floor}. Cash out again to take it.`,
  pending: "Waiting for the chain to answer — the sell is journaled, nothing is re-sent.",
  done: "Cashed out",
  doneBody: (proceeds: string, toVault: boolean) => `${proceeds} is back in your ${toVault ? "Trading Balance" : "wallet"}.`,
} as const;

export interface CashOutTarget {
  marketId: MarketId;
  side: Side;
  /** What this route holds on that side. */
  heldRaw: bigint;
  decimals: number;
  symbol: string | undefined;
  /** The wallet's own seat by default; `vault` sells from the Trading Balance's slot. */
  route?: OrderRoute;
  /** Reads outside the shared write families that this sell changes (the vault's open bets). */
  onConfirmed?: () => Promise<void>;
}

function refusalNote(d: Diagnosis): string {
  if (d.kind === "no-liquidity") return CASH_OUT.noLiquidity;
  if (d.kind === "market-not-trading") return CASH_OUT.locked;
  if (d.kind === "not-deployed") return CASH_OUT.notLive;
  return diagnosisCopy(d.kind).headline;
}

/**
 * One open bet's cash-out: a fresh exit quote at the tap, then the IOC sell on the submitter's lane with that quote's
 * floor (`minProceedsBase`). Nothing polls for rows nobody cashes out. A requote keeps the fresh exit so the next tap
 * accepts exactly that floor; every refusal is a sentence beside the link, never a silent failure.
 */
export function useCashOut(target: CashOutTarget) {
  const submitter = useSubmitter();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [requoted, setRequoted] = useState<ExitQuote | null>(null);
  const money = (base: bigint) => `${formatBaseUnits(base, target.decimals)} ${target.symbol ?? ""}`.trim();

  const cashOut = async () => {
    if (!submitter || !address || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const market = await marketsProvider.getMarket(target.marketId);
      if (!isOk(market)) return setNote(refusalNote(market.error));
      if (!market.value) return setNote(CASH_OUT.noLiquidity);
      let exit = requoted;
      if (!exit) {
        const { marketId, poolAddress, decimals, intervalSec } = market.value;
        const quote = await marketsProvider.freshExitQuote({ marketId, poolAddress, decimals, intervalSec }, target.side, target.heldRaw);
        if (!isOk(quote)) return setNote(refusalNote(quote.error));
        if (!quote.value) return setNote(CASH_OUT.noLiquidity);
        exit = quote.value;
      }
      setRequoted(null);
      const outcome = await submitter.submitCashOut({
        market: market.value,
        side: target.side,
        contractsRaw: exit.contractsRaw,
        displayedExit: exit,
        wallet: address,
        ...(target.route ? { route: target.route } : {}),
      });
      switch (outcome.status) {
        case "confirmed":
          notify.neutral(CASH_OUT.done, CASH_OUT.doneBody(money(outcome.booked.proceedsBase ?? exit.expectedProceedsBase), target.route?.kind === "vault"));
          await Promise.all([invalidateAfterWrite(queryClient, { wallet: address, marketId: target.marketId }), target.onConfirmed?.()]);
          return;
        case "requote":
          setRequoted(outcome.exit);
          return setNote(CASH_OUT.requote(money(outcome.exit.minProceedsBase)));
        case "nothingFilled":
          return setNote(CASH_OUT.nothingSold);
        case "unknown":
          return setNote(CASH_OUT.pending);
        default:
          return setNote(refusalNote(outcome.diagnosis));
      }
    } finally {
      setBusy(false);
    }
  };

  return { canSign: submitter !== null && address !== null, busy, note, cashOut };
}
