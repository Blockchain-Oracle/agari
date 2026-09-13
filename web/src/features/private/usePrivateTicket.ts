"use client";

import { formatCadence, type BlockerContext, type BlockerKind } from "@masayume/core/copy";
import type { BookedOrder } from "@masayume/core/ports";
import type { PrivateBudget, PrivateOpenResult, PrivateQuote } from "@masayume/core/private";
import { isOk } from "@masayume/core/schemas";
import type { Diagnosis, EventMarket, Side } from "@masayume/core/types";
import { formatBaseUnits, oneUnit, priceRawToBps } from "@masayume/core/units";
import { usePrivateBudget, usePrivateDesk } from "@masayume/markets/react";
import { useCallback, useEffect, useState } from "react";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { SIDE_WORD } from "../markets/side-styles";
import { commonBlocker, type TicketBlockerInput } from "../markets/ticket/ticket-guards";
import { PRIVATE } from "./copy";
import { derivePrivateBlocker } from "./private-blocker";
import { usePrivateOpen, type PendingOpen } from "./usePrivateOpen";
import { usePrivateQuote } from "./usePrivateQuote";
import { usePrivateStatus } from "./usePrivateStatus";
import { usePrivateWrites } from "./usePrivateWrites";

/** The reference tops up "a few bets' worth" — four stakes — and never more than the wallet holds. */
const TOP_UP_STAKES = 4n;
/** The open refuses a fill more than 5% under the size read after the signature; the stake never changes. */
const FILL_FLOOR_BPS = 9_500n;

export interface PrivateTicketInput {
  market: EventMarket;
  side: Side | null;
  stakeBase: bigint;
  enabled: boolean;
  symbol: string;
  walletSpendableBase: bigint | null;
  base: TicketBlockerInput;
}

export type PrivateBusy = "fund" | "open" | null;

export interface PrivateTicketState {
  deployed: boolean;
  probing: boolean;
  ready: boolean;
  reason: string | null;
  retryStatus: () => void;
  budget: PrivateBudget | null;
  budgetReadable: boolean;
  quote: PrivateQuote | null;
  quoteLoading: boolean;
  quoteError: Diagnosis | null;
  retryQuote: () => void;
  /** What the balance itself lacks — covered by a wallet deposit. */
  depositShortBase: bigint;
  topUpBase: bigint;
  /** The balance covers it but the desk's allowance does not — a zero-amount re-allow, no wallet money. */
  reallowOnly: boolean;
  overCap: boolean;
  /** An authorisation the desk never answered; the next tap resumes it. */
  pending: PendingOpen | null;
  blocker: BlockerKind | null;
  ctx: Partial<BlockerContext>;
  busy: PrivateBusy;
  place: () => Promise<void>;
  fund: () => Promise<void>;
  placed: BookedOrder | null;
  reset: () => void;
}

const windowWords = (asset: string, intervalSec: number) => `${asset} ${formatCadence(intervalSec)}`;

/** Everything the Ticket's private route needs, derived once: the desk's readiness, the owner's budget, the desk's quote, the ladder, and the one-action place. */
export function usePrivateTicket({ market, side, stakeBase, enabled, symbol, walletSpendableBase, base }: PrivateTicketInput): PrivateTicketState {
  const { address } = useWalletSession();
  const deskReading = usePrivateDesk();
  const desk = deskReading && isOk(deskReading) ? deskReading.value : null;
  const deployed = desk !== null;
  const status = usePrivateStatus(deployed);
  const budgetReading = usePrivateBudget(enabled ? address : null);
  const budget = budgetReading && isOk(budgetReading) ? budgetReading.value : null;
  const budgetReadable = budgetReading === null ? true : isOk(budgetReading);
  const quote = usePrivateQuote({ market, side, stakeBase, enabled: enabled && status.status?.ready === true && base.phase === "trading" });
  const writes = usePrivateWrites();
  const opener = usePrivateOpen();
  const [busy, setBusy] = useState<PrivateBusy>(null);
  const [placed, setPlaced] = useState<BookedOrder | null>(null);
  const decimals = market.decimals;

  // The two shortfalls are different fixes: the balance's needs wallet money; the allowance's needs only a re-allow
  // (every charge spends allowance, and a refund restores the balance but never the desk's permission).
  const balance = budget?.balanceBase ?? 0n;
  const allowance = budget?.allowanceBase ?? 0n;
  const depositShortBase = stakeBase > balance ? stakeBase - balance : 0n;
  const reallowOnly = budget !== null && depositShortBase === 0n && stakeBase > allowance;
  const wanted = stakeBase * TOP_UP_STAKES;
  const wallet = walletSpendableBase ?? 0n;
  const topUpBase = depositShortBase === 0n ? 0n : wanted < wallet ? wanted : wallet;
  const walletCanCover = walletSpendableBase !== null && walletSpendableBase >= depositShortBase;
  const minStakeBase = status.status?.minStakeBase ? BigInt(status.status.minStakeBase) : (desk?.params.minStakeBase ?? null);
  const maxStakeBase = status.status?.maxStakeBase ? BigInt(status.status.maxStakeBase) : (desk?.params.maxStakeBase ?? null);
  const overCap = maxStakeBase !== null && stakeBase > maxStakeBase;
  const pending = opener.pending;

  const guarded: TicketBlockerInput = { ...base, placing: base.placing || busy !== null };
  const blocker = !enabled
    ? commonBlocker({ ...guarded, availableBase: null, funding: null })
    : pending
      ? (commonBlocker({ ...guarded, availableBase: null, funding: null, side: "up", stakeBase: 1n }) ?? null)
      : derivePrivateBlocker(guarded, { deployed, probing: status.probing, ready: status.status?.ready === true, minStakeBase, maxStakeBase, budgetReadable, shortBase: depositShortBase, walletCanCover, quote: quote.quote, quoteLoading: quote.loading, quoteError: quote.error });
  const ctx: Partial<BlockerContext> = {
    privateMinText: minStakeBase !== null ? `${formatBaseUnits(minStakeBase, decimals, { minDp: 0 })} ${symbol}` : undefined,
    privateCapText: maxStakeBase !== null ? `${formatBaseUnits(maxStakeBase, decimals, { minDp: 0 })} ${symbol}` : undefined,
    spendableText: walletSpendableBase !== null ? `${formatBaseUnits(walletSpendableBase, decimals)} ${symbol}` : undefined,
  };

  useEffect(() => setPlaced(null), [stakeBase, side]);

  /** What the desk answered, told and booked. A ticket resumed after a lost reply has no hashes to link, so it is told and left to the claims list. */
  const settle = useCallback(
    (result: PrivateOpenResult | null, sideOf: Side | null) => {
      if (!result) return;
      if (result.status === "opened") {
        const t = result.ticket;
        const window = windowWords(t.asset, t.intervalSec);
        const contractsRaw = BigInt(t.quantityRaw);
        const costBase = BigInt(t.costBase);
        const bookedSide: Side = t.claim.outcomeIdx === 0 ? "up" : "down";
        if (t.txs.mint === "0x" || t.txs.mint.length < 10) {
          notify.neutral(PRIVATE.toasts.resumed(window));
          return;
        }
        const avgRaw = contractsRaw === 0n ? 0n : (costBase * oneUnit(decimals) + contractsRaw - 1n) / contractsRaw;
        setPlaced({ marketId: t.claim.marketId, side: bookedSide, contractsRaw, costBase, avgPriceBps: priceRawToBps(avgRaw, decimals), txHash: t.txs.mint, fillCount: 1 });
        notify.neutral(PRIVATE.toasts.placed(SIDE_WORD[sideOf ?? bookedSide], window));
      } else if (result.status === "refused") {
        notify.warning(result.reason, result.technical);
        quote.retry();
      } else {
        notify.warning(PRIVATE.toasts.unknown, result.reason);
      }
    },
    [decimals, quote],
  );

  /** Top up and authorise in one transaction (the reference's `submitPrivateTopUp`): the new balance is what the desk may spend. A zero amount is the plain re-allow. */
  const fund = useCallback(async () => {
    if (!budget) return;
    if (!reallowOnly && topUpBase === 0n) return;
    setBusy("fund");
    try {
      const amountBase = reallowOnly ? 0n : topUpBase;
      await writes.run({ kind: "private-deposit-and-allow", amountBase, allowanceBase: budget.balanceBase + amountBase }, PRIVATE.toasts.toppedUp);
    } finally {
      setBusy(null);
    }
  }, [budget, reallowOnly, topUpBase, writes]);

  /** One action even the first time: a pending authorisation is resumed before anything else; then the top-up or re-allow when needed, then the signature and the desk. */
  const place = useCallback(async () => {
    if (blocker) return;
    if (pending) {
      setBusy("open");
      try {
        settle(await opener.resume(), null);
      } catch (error) {
        notify.warning(PRIVATE.cta.notPlaced, error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(null);
      }
      return;
    }
    if (!side || !quote.quote || !desk) return;
    if (depositShortBase > 0n || reallowOnly) {
      if (!budget || (depositShortBase > 0n && topUpBase < depositShortBase)) return;
      setBusy("fund");
      const amountBase = reallowOnly ? 0n : topUpBase;
      const funded = await writes.run({ kind: "private-deposit-and-allow", amountBase, allowanceBase: budget.balanceBase + amountBase }, null);
      if (funded?.status !== "confirmed") {
        setBusy(null);
        return;
      }
    }
    setBusy("open");
    try {
      settle(await opener.open({ market, contract: desk.deployment.privateDesk, chainId: desk.deployment.chainId, side, stakeBase, fillFloorBps: FILL_FLOOR_BPS, symbol }), side);
    } catch (error) {
      notify.warning(PRIVATE.cta.notPlaced, error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }, [blocker, pending, side, quote.quote, desk, depositShortBase, reallowOnly, budget, topUpBase, writes, opener, market, stakeBase, symbol, settle]);

  return {
    deployed,
    probing: status.probing,
    ready: status.status?.ready === true,
    reason: status.reason,
    retryStatus: status.retry,
    budget,
    budgetReadable,
    quote: quote.quote,
    quoteLoading: quote.loading,
    quoteError: quote.error,
    retryQuote: quote.retry,
    depositShortBase,
    topUpBase,
    reallowOnly,
    overCap,
    pending,
    blocker,
    ctx,
    busy,
    place,
    fund,
    placed,
    reset: () => setPlaced(null),
  };
}
