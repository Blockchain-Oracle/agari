"use client";

import { formatCadence, type BlockerContext } from "@agari/core/copy";
import { leverageBpsOf } from "@agari/core/leverage";
import type { BookedOrder } from "@agari/core/ports";
import { minStakeBase } from "@agari/core/sizing";
import { formatBaseUnits, priceRawToBps } from "@agari/core/units";
import { collateralOrNull } from "@agari/markets";
import { useBalanceSheet, useLeverageReserve, useOnchain, useRangeReserve, useSigner } from "@agari/markets/react";
import { useCallback, useEffect, useState } from "react";
// By file, not the feature barrels: those also export components, and the app (D-129) reuses this hook alone.
import { LEVERAGE } from "@/features/leverage/copy";
import { useLeverageQuote } from "@/features/leverage/useLeverageQuote";
import { useLeverageWrites } from "@/features/leverage/useLeverageWrites";
import { PRIVATE } from "@/features/private/copy";
import { usePrivateTicket } from "@/features/private/usePrivateTicket";
import { RANGE } from "@/features/range/copy";
import { formatProbE6 } from "@/features/range/format";
import { useRangeTicket } from "@/features/range/useRangeTicket";
import { useTicketRoute, type FundingSource } from "@/features/session/useTicketRoute";
import { useRegionRestricted } from "@/lib/region";
import { diagnosisCopy, TICKET } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { useWhen } from "@/lib/when";
import { useTopOfBook } from "../hero/useTopOfBook";
import { SIDE_WORD } from "../side-styles";
import type { BetMode } from "./BetModes";
import { boostCells, plainCells, privateCells, rangeCells } from "./readout-cells";
import { useSeatDeposit } from "./seat-deposit";
import { deriveBlocker, deriveBoostBlocker, isFreshBook, type TicketBlockerInput } from "./ticket-guards";
import type { TicketSelection } from "./types";
import { useFundingCheck } from "./useFunding";
import { useLaneGuard } from "./useLaneGuard";
import { usePlaceBet } from "./usePlaceBet";
import { useQuote } from "./useQuote";
import { useTicket } from "./useTicket";

const FALLBACK_SYMBOL = "tUSDC";
/** The reference sizes with an 8% cushion for a quote that drifts before it lands; a boost accepts up to 5% fewer contracts. */
const BOOST_FILL_FLOOR_BPS = 9_500n;

interface PlacedBoost {
  booked: BookedOrder;
  leverage: { leverageBps: number; frontedBase: bigint };
}

/** The Ticket's composition (Ticket.tsx's logic, whole): what every renderer of it — web's, the app's — draws from. */
export function useTicketComposer(selection: TicketSelection) {
  const t = useTicket(selection);
  const { market, side, stakeBase, phase } = t;
  const decimals = market.decimals;
  const symbol = collateralOrNull()?.symbol ?? FALLBACK_SYMBOL;

  const session = useWalletSession();
  const { address, hasSigner } = useSigner();
  const sheet = useBalanceSheet(address);
  const balances = sheet?.ok ? sheet.value : null;
  const walletAvailableBase = balances ? balances.spendableBase + balances.venueCreditBase : null;
  const onchain = useOnchain(market.marketId);

  // Where the escrow comes from: the wallet, the Trading Balance, the private desk's slot, or — armed — the session key inside its caps.
  const [source, setSource] = useState<FundingSource>("wallet");
  const [lastPublic, setLastPublic] = useState<Exclude<FundingSource, "private">>("wallet");
  const privateMode = source === "private";
  const [mode, setMode] = useState<BetMode>("dir");
  const rangeReading = useRangeReserve();
  const rangeReserve = rangeReading?.ok ? rangeReading.value : null;
  const [multiple, setMultiple] = useState(1);
  const leverageReading = useLeverageReserve();
  const leverageReserve = leverageReading?.ok ? leverageReading.value : null;
  const boosted = multiple > 1 && leverageReserve !== null;
  const leverageBps = leverageBpsOf(multiple);
  const isRange = mode === "range" && rangeReserve !== null;

  const quoteState = useQuote({ market, side, stakeBase, nowMs: t.nowMs, enabled: hasSigner && phase === "trading" && !boosted && !privateMode && !isRange });
  const routing = useTicketRoute({ market, side, stakeBase, quote: quoteState.quote, onchain: onchain?.ok ? onchain.value : null, source: privateMode ? "wallet" : source, walletAvailableBase, symbol });
  const availableBase = routing.availableBase;
  // The reference locks the higher chips for a private bet ("placed at 1x"); ours also lock off the wallet route and under a pause.
  const leverageLock = privateMode ? LEVERAGE.lockedForPrivate : leverageReserve?.paused ? LEVERAGE.paused : source !== "wallet" || routing.armed ? LEVERAGE.lockedForRoute : null;
  useEffect(() => {
    if (leverageLock && multiple !== 1) setMultiple(1);
  }, [leverageLock, multiple]);
  const boost = useLeverageQuote({ market, side, stakeBase, leverageBps, params: leverageReserve?.params ?? null, enabled: boosted && hasSigner && phase === "trading" && leverageLock === null && !isRange });
  const leverageWrites = useLeverageWrites();
  const [placedBoost, setPlacedBoost] = useState<PlacedBoost | null>(null);
  const range = useRangeTicket({ market, phase, decimals, symbol, reserve: rangeReserve, stakeBase, availableBase: balances?.spendableBase ?? null, session, hasSigner, enabled: isRange });

  const bet = usePlaceBet({ submitter: routing.submitter, wallet: routing.wallet });
  // A requote belongs to the Window, side and stake it priced: after an advance or an edit the fresh quote leads.
  const displayed = bet.requoteFor(market.marketId, side, stakeBase) ?? quoteState.quote;
  const walletRoute = routing.route.kind === "wallet" && !privateMode;
  const funding = useFundingCheck(walletRoute ? address : null, onchain?.ok ? onchain.value : null, displayed);
  // A plain wallet order also funds the seat deposit on its first order in the Window; the guard and the top-up leave room for it.
  const seatDeposit = useSeatDeposit(walletRoute ? address : null, onchain?.ok ? onchain.value : null);
  const depositBase = walletRoute && !boosted && !isRange ? seatDeposit : 0n;
  const laneGuard = useLaneGuard(market);
  // A 24/7 Window nobody quotes (S23): the ticket says so and when the next Window starts, never "no liquidity at this size".
  const top = useTopOfBook(market);
  const when = useWhen();
  const emptyBook = market.lane === "token" && phase === "trading" && !top.hydrating && top.upCents === null && top.downCents === null;
  const nextWindowText = emptyBook ? when(market.expirySec, { clock: true }) : undefined;
  // The geofence (D-095): a held browser reads the Window and funds nothing on it.
  const regionHeld = useRegionRestricted();

  const base: TicketBlockerInput = {
    session,
    hasSigner,
    phase,
    placing: bet.placing || leverageWrites.busy === "open",
    side,
    availableBase,
    stakeBase,
    depositBase,
    decimals,
    quote: quoteState.reading,
    quoting: quoteState.pending,
    quoteStale: quoteState.stale,
    funding: walletRoute ? funding : null,
    lane: laneGuard.lane,
    region: regionHeld,
  };
  const priv = usePrivateTicket({ market, side, stakeBase, enabled: privateMode && hasSigner, symbol, walletSpendableBase: balances?.spendableBase ?? null, base });
  // Off by default and never silently on. The desk going away is said aloud; a band takes the wallet.
  useEffect(() => {
    if (!privateMode) return;
    if (isRange) setSource(lastPublic);
    else if (!priv.probing && !priv.ready) {
      setSource(lastPublic);
      notify.warning(PRIVATE.route.label, PRIVATE.toasts.flippedOff(priv.reason ?? "not ready"));
    }
  }, [privateMode, priv.probing, priv.ready, priv.reason, isRange, lastPublic]);

  // A new stake or side starts a new composition; the previous outcome no longer describes it.
  useEffect(() => {
    bet.reset();
    setPlacedBoost(null);
  }, [stakeBase, side, bet.reset]);

  const blocker = boosted ? deriveBoostBlocker({ ...base, funding: null }, boost) : deriveBlocker(base);
  const ctx: BlockerContext = {
    ...laneGuard.ctx,
    cadence: formatCadence(market.intervalSec),
    minStakeText: `${formatBaseUnits(minStakeBase(decimals), decimals, { minDp: 0 })} ${symbol}`,
    spendableText: availableBase !== null ? `${formatBaseUnits(availableBase, decimals)} ${symbol}` : undefined,
    quotedCents: displayed?.oddsCents,
    fillableStakeText: displayed?.partial ? `${formatBaseUnits(displayed.fillableStakeBase, decimals)} ${symbol}` : undefined,
    freshBook: isFreshBook(market.tradingStartSec, t.nowMs),
    emptyBook,
    nextWindowText,
  };
  const showRoute = routing.deployed && ((routing.vaultAvailableBase ?? 0n) > 0n || routing.armed);
  const privateTitle = isRange ? PRIVATE.route.titleRange : priv.probing ? PRIVATE.route.titleProbing : !priv.ready ? PRIVATE.route.titleUnavailable(priv.reason ?? "not ready") : priv.overCap && priv.ctx.privateCapText ? PRIVATE.route.titleOverCap(priv.ctx.privateCapText) : PRIVATE.route.titleReady;
  const choosePrivate = (wantPriv: boolean) => {
    if (wantPriv) setSource("private");
    else setSource(lastPublic);
  };
  const chooseSource = (next: FundingSource) => {
    if (next !== "private") setLastPublic(next);
    setSource(next);
  };

  const place = () => {
    if (!side || !displayed) return;
    void bet.place({ market, side, stakeBase, displayedQuote: displayed, route: routing.route });
  };

  /** The boost's open: the typed stake, guarded at 95% of the size the reserve quoted; a moved book comes back as a requote, never a popup. */
  const placeBoost = useCallback(async () => {
    if (!side || !boost.quote || !leverageReserve) return;
    const q = boost.quote;
    const outcome = await leverageWrites.open({ marketId: market.marketId, side, stakeBase, leverageBps, minQuantityRaw: (q.quantityRaw * BOOST_FILL_FLOOR_BPS) / 10_000n });
    if (!outcome) return;
    if (outcome.status === "confirmed") {
      const avgPriceBps = priceRawToBps(q.priceRaw, decimals);
      setPlacedBoost({
        booked: { marketId: market.marketId, side, contractsRaw: outcome.quantityRaw, costBase: outcome.stakeBase, avgPriceBps, txHash: outcome.txHash, fillCount: 1 },
        leverage: { leverageBps, frontedBase: outcome.frontedBase },
      });
      notify.neutral(TICKET.booked(formatBaseUnits(outcome.quantityRaw, decimals, { minDp: 0 }), SIDE_WORD[side], avgPriceBps));
      return;
    }
    if (outcome.status === "requote") {
      notify.warning(diagnosisCopy("requote").headline, LEVERAGE.strip.requote(formatBaseUnits(outcome.quantityRaw, decimals, { minDp: 0 })));
      boost.retry();
      return;
    }
    const copy = diagnosisCopy(outcome.diagnosis.kind);
    notify.warning(copy.headline, outcome.diagnosis.technical || copy.body);
  }, [side, boost, leverageReserve, leverageWrites, market.marketId, stakeBase, leverageBps, decimals]);

  // ── the strip: one set of three numbers, whichever bet is being composed ──
  const ready = side !== null || isRange;
  const strip = (() => {
    if (isRange) {
      const q = range.quote;
      const caption = range.draft.dragging ? RANGE.ticket.releaseToPrice : range.quoteState.error ? TICKET.quoteFailed(diagnosisCopy(range.quoteState.error.kind).headline) : q ? (range.upToText ?? TICKET.liveOdds) : stakeBase > 0n ? TICKET.gettingQuote : TICKET.enterAmount;
      return { cells: rangeCells(q, decimals), live: q !== null, caption, chance: q ? RANGE.ticket.odds(formatProbE6(q.insideProbE6), "inside") : null };
    }
    if (boosted) {
      const q = boost.quote;
      const caption = boost.error ? TICKET.quoteFailed(diagnosisCopy(boost.error.kind).headline) : q ? (q.stakeBase < stakeBase ? LEVERAGE.strip.sized(formatBaseUnits(q.stakeBase, decimals), symbol) : TICKET.liveOdds) : boost.loading ? TICKET.gettingQuote : TICKET.enterAmount;
      return { cells: boostCells(q, decimals), live: q !== null, caption, chance: q ? TICKET.chance(Math.round(priceRawToBps(q.priceRaw, decimals) / 100)) : null };
    }
    if (privateMode) {
      const q = priv.quote;
      const caption = priv.quoteError ? TICKET.quoteFailed(diagnosisCopy(priv.quoteError.kind).headline) : q ? (q.costBase < stakeBase ? PRIVATE.quote.sized(formatBaseUnits(q.costBase, decimals), symbol) : TICKET.liveOdds) : priv.quoteLoading ? TICKET.gettingQuote : TICKET.enterAmount;
      return { cells: privateCells(q, decimals), live: q !== null, caption, chance: q ? TICKET.chance(Math.round(priceRawToBps(q.priceRaw, decimals) / 100)) : null };
    }
    const q = displayed;
    const failed = quoteState.reading && !quoteState.reading.ok ? quoteState.reading.error : null;
    const caption = failed ? TICKET.quoteFailed(diagnosisCopy(failed.kind).headline) : q ? (q.partial ? TICKET.partial(`${formatBaseUnits(q.fillableStakeBase, decimals)} ${symbol}`) : quoteState.stale || quoteState.pending ? TICKET.requoting : TICKET.liveOdds) : quoteState.pending ? TICKET.gettingQuote : emptyBook ? `${CLOSED.noQuotesLine} ${CLOSED.nextWindow(nextWindowText ?? "")}` : ready && stakeBase > 0n && hasSigner ? TICKET.noLiquidity : TICKET.enterAmount;
    return { cells: plainCells(q, decimals), live: q !== null, caption, chance: q ? TICKET.chance(Math.round(q.avgPriceBps / 100)) : null };
  })();
  const costForSr = isRange ? (range.quote?.stakeBase ?? null) : boosted ? (boost.quote?.stakeBase ?? null) : privateMode ? (priv.quote?.costBase ?? null) : (displayed?.expectedCostBase ?? null);

  // The Call: once the fill is confirmed the ticket body is the shareable card, with
  // "Place another" bringing the composer back (reference Ticket624Drawer L807–836).
  const booked = placedBoost?.booked ?? priv.placed ?? (bet.state.outcome?.status === "confirmed" ? bet.state.outcome.booked : null);
  const privParts = { priv, side, stakeBase, decimals, symbol };
  const reset = () => {
    bet.reset();
    setPlacedBoost(null);
    priv.reset();
    range.reset();
    t.setStakeText("");
  };

  return { t, market, side, stakeBase, phase, decimals, symbol, session, source, privateMode, mode, setMode, rangeReserve, multiple, setMultiple, leverageReserve, boosted, isRange, leverageLock, boost, range, bet, displayed, walletRoute, funding, depositBase, laneGuard, regionHeld, priv, blocker, ctx, showRoute, privateTitle, choosePrivate, chooseSource, place, placeBoost, strip, costForSr, booked, privParts, reset, routing, availableBase, placedBoost };
}

export type TicketComposer = ReturnType<typeof useTicketComposer>;
