"use client";

import { formatCadence, type BlockerContext } from "@masayume/core/copy";
import { BPS_PER_X, leverageBpsOf } from "@masayume/core/leverage";
import type { BookedOrder } from "@masayume/core/ports";
import { belowMinStake, minStakeBase } from "@masayume/core/sizing";
import { formatBaseUnits, priceRawToBps } from "@masayume/core/units";
import { collateralOrNull } from "@masayume/markets";
import { useBalanceSheet, useLeverageReserve, useOnchain, useRangeReserve, useSigner } from "@masayume/markets/react";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Money } from "@/components/data";
import { BlockedButton } from "@/components/states";
import { LEVERAGE, useLeverageQuote, useLeverageWrites } from "@/features/leverage";
import { PRIVATE, PrivateCta, PrivateNote, usePrivateTicket } from "@/features/private";
import { BandControl, formatProbE6, RANGE, RangePlaced, usdBand, useRangeTicket } from "@/features/range";
import { useTicketRoute, type FundingSource } from "@/features/session";
import { diagnosisCopy, TICKET } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { useWalletSession } from "@/lib/wallet-session";
import { SIDE_WORD } from "../side-styles";
import { AccountGate } from "./AccountGate";
import { AmountBlock } from "./AmountBlock";
import { AutoAdvanceNote } from "./AutoAdvanceNote";
import { BetModes, type BetMode } from "./BetModes";
import { OutcomeNote } from "./OutcomeNote";
import { PlacedCall } from "./PlacedCall";
import { PublicPrivate } from "./PublicPrivate";
import { boostCells, plainCells, privateCells, rangeCells } from "./readout-cells";
import { ReadoutStrip } from "./ReadoutStrip";
import { SideSegments } from "./SideSegments";
import { deriveBlocker, deriveBoostBlocker, type TicketBlockerInput } from "./ticket-guards";
import { TicketCta } from "./TicketCta";
import { TicketHeader } from "./TicketHeader";
import { TicketMiniChart } from "./TicketMiniChart";
import type { TicketSelection } from "./types";
import { useFundingCheck } from "./useFunding";
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

interface TicketProps {
  selection: TicketSelection;
  /** Present when the ticket is the mobile drawer: it then carries its own head and close, as the reference's does. */
  drawer?: { onClose: () => void };
}

/**
 * The Ticket — the reference's composer, block for block (`Ticket624Drawer.tsx` L847–1277):
 *
 *   mode · side (or the band) · the amount block · the three-column strip and its caption ·
 *   the account gates · Public / Private · the CTA · the footnote
 *
 * Nine blocks, and the sizing controls are one of them. Every kind of bet this ticket can compose — a
 * plain order, a boost, a private bet, a band — feeds the same strip and the same button, so changing
 * leverage or route changes the numbers and never the shape. The stake-first rule holds throughout:
 * exactly the deal shown, or a named refusal on the button (FR-8, FR-9, UX-DR4).
 */
export function Ticket({ selection, drawer }: TicketProps) {
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
  const displayed = bet.requoted ?? quoteState.quote;
  const walletRoute = routing.route.kind === "wallet" && !privateMode;
  const funding = useFundingCheck(walletRoute ? address : null, onchain?.ok ? onchain.value : null, displayed);

  const base: TicketBlockerInput = {
    session,
    hasSigner,
    phase,
    placing: bet.placing || leverageWrites.busy === "open",
    side,
    availableBase,
    stakeBase,
    decimals,
    quote: quoteState.reading,
    quoting: quoteState.pending,
    quoteStale: quoteState.stale,
    funding: walletRoute ? funding : null,
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
    cadence: formatCadence(market.intervalSec),
    minStakeText: `${formatBaseUnits(minStakeBase(decimals), decimals, { minDp: 0 })} ${symbol}`,
    spendableText: availableBase !== null ? `${formatBaseUnits(availableBase, decimals)} ${symbol}` : undefined,
    quotedCents: displayed?.oddsCents,
    fillableStakeText: displayed?.partial ? `${formatBaseUnits(displayed.fillableStakeBase, decimals)} ${symbol}` : undefined,
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
    const outcome = await leverageWrites.open({ marketId: market.marketId, side, stakeBase, leverageBps, minQuantityRaw: (q.quantityRaw * BOOST_FILL_FLOOR_BPS) / 10_000n, maintenanceBps: leverageReserve.params.maintenanceBps });
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
    const caption = failed ? TICKET.quoteFailed(diagnosisCopy(failed.kind).headline) : q ? (q.partial ? TICKET.partial(`${formatBaseUnits(q.fillableStakeBase, decimals)} ${symbol}`) : quoteState.stale || quoteState.pending ? TICKET.requoting : TICKET.liveOdds) : quoteState.pending ? TICKET.gettingQuote : ready && stakeBase > 0n && hasSigner ? TICKET.noLiquidity : TICKET.enterAmount;
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

  const cta = isRange ? (
    <BlockedButton blocker={range.blocker} ctx={range.ctx} tone="primary" size="lg" className="w-full" onClick={() => void range.place()}>
      {range.draft.lowPrint !== null && range.draft.highPrint !== null ? RANGE.cta.place(usdBand(range.draft.lowPrint), usdBand(range.draft.highPrint)) : RANGE.cta.placePlain}
    </BlockedButton>
  ) : boosted ? (
    <BlockedButton blocker={blocker} ctx={ctx} tone={side ?? "primary"} size="lg" className="w-full" onClick={() => void placeBoost()}>
      {side && boost.quote ? (
        <>
          {LEVERAGE.cta.buy(SIDE_WORD[side], multiple)} <Money value={boost.quote.stakeBase} decimals={decimals} symbol={symbol} />
        </>
      ) : (
        TICKET.buyPlain
      )}
    </BlockedButton>
  ) : privateMode ? (
    <PrivateCta {...privParts} ctx={ctx} />
  ) : (
    <TicketCta blocker={blocker} ctx={ctx} side={side} costBase={displayed?.maxCostBase ?? null} decimals={decimals} symbol={symbol} onClick={place} />
  );

  return (
    <section aria-label={TICKET.title} className={`tk-ticket ${drawer ? "tk-ticket--drawer" : "tk-ticket--rail"}`}>
      {drawer && (
        <>
          <button type="button" onClick={drawer.onClose} aria-label={TICKET.close} className="tk-drawer-close" data-cursor="hover">
            <X className="h-4 w-4" />
          </button>
          <div className="tk-drawer-head">
            <TicketHeader market={market} phase={phase} nowMs={t.nowMs} />
          </div>
          <TicketMiniChart market={market} />
        </>
      )}
      {booked ? (
        <PlacedCall booked={booked} market={market} nowMs={t.nowMs} decimals={decimals} symbol={symbol} boost={placedBoost?.leverage ?? null} onAnother={reset} />
      ) : isRange && range.placed ? (
        <RangePlaced placed={range.placed} onAnother={reset} />
      ) : (
        <>
          <BetModes mode={mode} onChange={setMode} rangeAvailable={rangeReserve !== null} />
          {isRange ? <BandControl asset={market.asset} intervalSec={market.intervalSec} draft={range.draft} side="inside" /> : <SideSegments side={side} onSelect={t.selectSide} />}
          <AmountBlock
            value={t.stakeText}
            onChange={t.setStakeText}
            stakeBase={stakeBase}
            onStakeBase={t.setStakeBase}
            balanceBase={privateMode ? (priv.budget?.spendableBase ?? null) : availableBase}
            decimals={decimals}
            symbol={symbol}
            belowMin={stakeBase > 0n && belowMinStake(stakeBase, decimals)}
            leverage={isRange ? null : { value: multiple, onChange: setMultiple, available: leverageReserve !== null, maxMultiple: leverageReserve ? leverageReserve.params.maxLeverageBps / BPS_PER_X : 1, lockedReason: leverageLock }}
            costBase={costForSr}
          />
          <ReadoutStrip cells={strip.cells} live={strip.live} caption={strip.caption} chance={strip.chance} note={boosted ? LEVERAGE.strip.knockout(multiple) : null} />
          <AccountGate
            session={session}
            balanceSource={privateMode ? "private" : source}
            availableBase={privateMode ? (priv.budget?.spendableBase ?? null) : availableBase}
            stakeBase={stakeBase}
            decimals={decimals}
            symbol={symbol}
            route={privateMode ? null : { show: showRoute, source, onChange: chooseSource, vaultAvailableBase: routing.vaultAvailableBase, armed: routing.armed, deployed: routing.deployed }}
          />
          {!isRange && priv.deployed && (
            <PublicPrivate priv={privateMode} onChange={choosePrivate} privateEnabled={!priv.probing && priv.ready && !priv.overCap} privateTitle={privateTitle} retry={!priv.probing && !priv.ready ? priv.retryStatus : null} />
          )}
          {privateMode && <PrivateNote priv={priv} stakeBase={stakeBase} decimals={decimals} symbol={symbol} />}
          {t.advancedFrom && <AutoAdvanceNote from={t.advancedFrom} to={market} />}
          <OutcomeNote state={bet.state} decimals={decimals} symbol={symbol} onDismiss={bet.reset} />
          {cta}
          <p className="tk-foot">
            {isRange ? RANGE.cta.footnote : routing.armed ? TICKET.footnoteArmed : TICKET.footnote}
            {isRange && rangeReserve?.paused ? ` ${RANGE.ticket.reservePaused}` : null}
            {!isRange && !boosted && walletRoute && funding?.ok && funding.needsApproval ? ` ${TICKET.approvalNote}` : null}
            {!isRange && !boosted && walletRoute && funding?.ok && funding.venueCreditUsedBase > 0n ? ` ${TICKET.creditNote(`${formatBaseUnits(funding.venueCreditUsedBase, decimals)} ${symbol}`)}` : null}
          </p>
        </>
      )}
    </section>
  );
}
