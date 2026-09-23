import { diagnosisCopy } from "@agari/core/copy";
import type { OrderRoute } from "@agari/core/ports";
import { isOk } from "@agari/core/schemas";
import type { Diagnosis, EventMarket, ExitQuote, MarketId, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { marketsProvider } from "@agari/markets";
import { invalidateAfterWrite, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { CASH_OUT } from "@/features/markets/portfolio/useCashOut";
import { useWalletSession } from "@/lib/wallet-session";
import type { WriteResult } from "./useSignFlow";

export interface CashOutTarget {
  marketId: MarketId;
  side: Side;
  heldRaw: bigint;
  decimals: number;
  symbol: string | undefined;
  /** The wallet's own seat by default; `vault` sells from the Trading Balance's slot. */
  route?: OrderRoute;
  onConfirmed?: () => Promise<void>;
}

/** web `useCashOut.refusalNote`, word for word. */
function refusalNote(d: Diagnosis): string {
  if (d.kind === "no-liquidity") return CASH_OUT.noLiquidity;
  if (d.kind === "market-not-trading") return CASH_OUT.locked;
  if (d.kind === "not-deployed") return CASH_OUT.notLive;
  return diagnosisCopy(d.kind).headline;
}

export type QuoteState = { kind: "idle" } | { kind: "quoting" } | { kind: "ready"; market: EventMarket; exit: ExitQuote } | { kind: "refused"; note: string };

/**
 * web `useCashOut`, split in two so the review can show the exact exit before anything is signed: `quote` reads the
 * Window and a fresh exit quote (what the Book fills now, the proceeds, the protective floor); `confirm` sends the IOC
 * sell with THAT quote as `displayedExit`, so the floor on the review is the floor the chain enforces. A requote
 * replaces the quote on the review and asks for a second slide — exactly web's "cash out again to take it".
 */
export function useCashOutReview(target: CashOutTarget) {
  const submitter = useSubmitter();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [quote, setQuote] = useState<QuoteState>({ kind: "idle" });
  const money = (base: bigint) => `${formatBaseUnits(base, target.decimals)} ${target.symbol ?? ""}`.trim();

  const load = useCallback(async () => {
    setQuote({ kind: "quoting" });
    const market = await marketsProvider.getMarket(target.marketId);
    if (!isOk(market)) return setQuote({ kind: "refused", note: refusalNote(market.error) });
    if (!market.value) return setQuote({ kind: "refused", note: CASH_OUT.noLiquidity });
    const { marketId, poolAddress, decimals, intervalSec } = market.value;
    const exit = await marketsProvider.freshExitQuote({ marketId, poolAddress, decimals, intervalSec }, target.side, target.heldRaw);
    if (!isOk(exit)) return setQuote({ kind: "refused", note: refusalNote(exit.error) });
    if (!exit.value) return setQuote({ kind: "refused", note: CASH_OUT.noLiquidity });
    setQuote({ kind: "ready", market: market.value, exit: exit.value });
  }, [target.marketId, target.side, target.heldRaw]);

  const confirm = useCallback(async (): Promise<WriteResult> => {
    if (quote.kind !== "ready") return { landed: false, tone: "warn", text: CASH_OUT.noLiquidity };
    if (!submitter || !address) return { landed: false, tone: "warn", text: "The wallet is not ready to sign yet." };
    const { market, exit } = quote;
    const outcome = await submitter.submitCashOut({
      market,
      side: target.side,
      contractsRaw: exit.contractsRaw,
      displayedExit: exit,
      wallet: address,
      ...(target.route ? { route: target.route } : {}),
    });
    switch (outcome.status) {
      case "confirmed": {
        await Promise.all([invalidateAfterWrite(queryClient, { wallet: address, marketId: target.marketId }), target.onConfirmed?.()]);
        const proceeds = money(outcome.booked.proceedsBase ?? exit.expectedProceedsBase);
        return { landed: true, tone: "ok", text: `${CASH_OUT.done}. ${CASH_OUT.doneBody(proceeds, target.route?.kind === "vault")}` };
      }
      case "requote":
        setQuote({ kind: "ready", market, exit: outcome.exit });
        return { landed: false, tone: "warn", text: CASH_OUT.requote(money(outcome.exit.minProceedsBase)) };
      case "nothingFilled":
        return { landed: false, tone: "warn", text: CASH_OUT.nothingSold };
      case "unknown":
        return { landed: false, tone: "warn", text: CASH_OUT.pending };
      default:
        return { landed: false, tone: "warn", text: refusalNote(outcome.diagnosis) };
    }
  }, [quote, submitter, address, target, queryClient]);

  return { quote, load, confirm, canSign: submitter !== null && address !== null, money };
}
