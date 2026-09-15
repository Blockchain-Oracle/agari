"use client";

import { formatCadence, type BlockerContext, type BlockerKind } from "@agari/core/copy";
import { isPriceCents, restingQuote, type RestingQuote, type RestUntil } from "@agari/core/orders";
import { isOk } from "@agari/core/schemas";
import type { Quote } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { collateralOrNull, marketsProvider } from "@agari/markets";
import { useBalanceSheet, useBook, useOnchain, useRestingOrders, useSigner } from "@agari/markets/react";
import { useEffect, useMemo, useState } from "react";
import { PREOPEN } from "@/lib/copy";
import { useWalletSession, type WalletSession } from "@/lib/wallet-session";
import { SIDE_WORD } from "../side-styles";
import { crossingOf, type Crossing } from "./crossing";
import { DEFAULT_PRICE_CENTS } from "./PriceControl";
import { deriveScheduleBlocker } from "./schedule-guards";
import { useSeatDeposit } from "./seat-deposit";
import type { TicketSelection } from "./types";
import { useFundingCheck } from "./useFunding";
import { useLaneGuard } from "./useLaneGuard";
import { usePlaceBet } from "./usePlaceBet";
import { useSeriesGrid } from "./useSeriesGrid";
import { useTicket, type TicketApi } from "./useTicket";

const FALLBACK_SYMBOL = "tUSDC";

export interface ScheduleTicketApi {
  t: TicketApi;
  session: WalletSession;
  symbol: string;
  priceCents: number;
  setPriceCents: (cents: number) => void;
  restUntil: RestUntil;
  setRestUntil: (until: RestUntil) => void;
  /** True once the Series grid is read; the strip sizes nothing before. */
  gridReady: boolean;
  sized: RestingQuote | null;
  /** The call as the chain will hold it: escrow, contracts, the YES-terms limit. Null until it can be sized. */
  quote: Quote | null;
  availableBase: bigint | null;
  depositBase: bigint;
  /** "0.25 tUSDC", the Series seat bond, for the footnote. */
  bondText: string;
  laneNote: string | null;
  blocker: BlockerKind | null;
  ctx: BlockerContext;
  bet: ReturnType<typeof usePlaceBet>;
  place: () => void;
}

/**
 * The scheduled call's composition (D-088): the same stake, side and Window as the taker's ticket (`useTicket`), plus
 * the user's own price and how long it rests. The quote is core `restingQuote` over the Series grid — pure integers,
 * the escrow the rest lane will re-derive before signing — so the strip, the gate and the CTA show the chain's
 * numbers. A crossing price is caught on the live book before the wallet opens; the lane checks again.
 */
export function useScheduleTicket(selection: TicketSelection): ScheduleTicketApi {
  const t = useTicket(selection);
  const { market, side, stakeBase, phase } = t;
  const decimals = market.decimals;
  const symbol = collateralOrNull()?.symbol ?? FALLBACK_SYMBOL;

  const session = useWalletSession();
  const { address, hasSigner } = useSigner();
  const sheet = useBalanceSheet(address);
  const balances = sheet?.ok ? sheet.value : null;
  const availableBase = balances ? balances.spendableBase + balances.venueCreditBase : null;
  const onchain = useOnchain(market.marketId);
  const snapshot = onchain?.ok ? onchain.value : null;

  const [priceCents, setPriceCents] = useState(DEFAULT_PRICE_CENTS);
  const [restUntil, setRestUntil] = useState<RestUntil>("bell");
  const grid = useSeriesGrid(market.seriesAddress);
  const sized = useMemo<RestingQuote | null>(
    () => (side && grid && isPriceCents(priceCents) ? restingQuote({ side, priceCents, stakeBase, grid, decimals, quotedAtMs: marketsProvider.nowMs() }) : null),
    [side, grid, priceCents, stakeBase, decimals],
  );
  const quote = sized?.ok ? sized.quote : null;

  const funding = useFundingCheck(address, snapshot, quote);
  const depositBase = useSeatDeposit(address, snapshot);
  const laneGuard = useLaneGuard(market);
  const book = useBook({ marketId: market.marketId, poolAddress: market.poolAddress, decimals });
  const crossing = useMemo<Crossing | null>(() => (side && book && isOk(book) && isPriceCents(priceCents) ? crossingOf(side, priceCents, book.value) : null), [side, book, priceCents]);
  const resting = useRestingOrders(address);
  const restingCount = resting === null ? null : resting.ok ? resting.value.filter((v) => v.marketId === market.marketId && (v.status === "resting" || v.status === "resting-for-open")).length : 0;

  const bet = usePlaceBet();
  // A new stake, side, price or horizon starts a new composition; the previous outcome no longer describes it.
  useEffect(() => {
    bet.reset();
  }, [stakeBase, side, priceCents, restUntil, bet.reset]);

  const blocker = deriveScheduleBlocker({ session, hasSigner, placing: bet.placing, phase, lane: laneGuard.lane, side, priceCents, stakeBase, availableBase, depositBase, sized, crossing, restingCount, funding });
  const ctx: BlockerContext = {
    ...laneGuard.ctx,
    cadence: formatCadence(market.intervalSec),
    minStakeText: sized?.sizing ? `${formatBaseUnits(sized.sizing.minStakeBase, decimals)} ${symbol}` : undefined,
    spendableText: availableBase !== null ? `${formatBaseUnits(availableBase, decimals)} ${symbol}` : undefined,
    quotedCents: priceCents,
    crossingText: crossing && side ? PREOPEN.ticket.crossing(SIDE_WORD[crossing.otherSide], crossing.otherCents, SIDE_WORD[side], crossing.maxCents) : undefined,
  };
  const bondText = grid ? `${formatBaseUnits(grid.seatBond, decimals)} ${symbol}` : "refundable";

  const place = () => {
    if (!side || !quote) return;
    void bet.place({ market, side, stakeBase, displayedQuote: quote, route: { kind: "wallet" }, entry: "rest", restUntil });
  };

  return { t, session, symbol, priceCents, setPriceCents, restUntil, setRestUntil, gridReady: grid !== null, sized, quote, availableBase, depositBase, bondText, laneNote: laneGuard.earnings, blocker, ctx, bet, place };
}
