"use client";

import { BPS_PER_X } from "@agari/core/leverage";
import { belowMinStake } from "@agari/core/sizing";
import { formatBaseUnits } from "@agari/core/units";
import { X } from "lucide-react";
import { Money } from "@/components/data";
import { BlockedButton } from "@/components/states";
import { LEVERAGE } from "@/features/leverage";
import { PrivateCta, PrivateNote } from "@/features/private";
import { BandControl, RANGE, RangePlaced, usdBand } from "@/features/range";
import { RegionNote } from "@/features/region/RegionNote";
import { TICKET } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { SIDE_WORD } from "../side-styles";
import { AccountGate } from "./AccountGate";
import { AmountBlock } from "./AmountBlock";
import { AutoAdvanceNote } from "./AutoAdvanceNote";
import { BetAgainstToggle } from "./BetAgainstToggle";
import { BetModes } from "./BetModes";
import { OutcomeNote } from "./OutcomeNote";
import { PlacedCall } from "./PlacedCall";
import { PublicPrivate } from "./PublicPrivate";
import { ReadoutStrip } from "./ReadoutStrip";
import { SideSegments } from "./SideSegments";
import { TicketCta } from "./TicketCta";
import { TicketHeader } from "./TicketHeader";
import { TicketMiniChart } from "./TicketMiniChart";
import type { TicketSelection } from "./types";
import { useTicketComposer } from "./useTicketComposer";

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
  const { t, market, side, stakeBase, phase, decimals, symbol, session, source, privateMode, mode, setMode, rangeReserve, multiple, setMultiple, leverageReserve, boosted, isRange, leverageLock, boost, range, bet, displayed, walletRoute, funding, depositBase, laneGuard, regionHeld, priv, blocker, ctx, showRoute, privateTitle, choosePrivate, chooseSource, place, placeBoost, strip, costForSr, booked, privParts, reset, routing, availableBase, placedBoost } = useTicketComposer(selection);

  const cta = isRange && !regionHeld ? (
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
          {isRange ? (
            <BandControl asset={market.asset} intervalSec={market.intervalSec} draft={range.draft} side="inside" spot={range.spot} />
          ) : (
            <>
              <SideSegments side={side} onSelect={t.selectSide} />
              {/* A-1a: the bearish mode. A band has no side to put first, so it is offered only on a direction call. */}
              <BetAgainstToggle />
            </>
          )}
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
          {!boosted && !privateMode && !isRange && displayed?.partial && displayed.fillableStakeBase > 0n && (
            <button type="button" className="tk-use-depth" onClick={() => t.setStakeBase(displayed.fillableStakeBase)}>
              {CLOSED.useDepth(`${formatBaseUnits(displayed.fillableStakeBase, decimals)} ${symbol}`)}
            </button>
          )}
          <ReadoutStrip cells={strip.cells} live={strip.live} caption={strip.caption} chance={strip.chance} note={[boosted ? LEVERAGE.strip.knockout(multiple) : null, laneGuard.earnings].filter(Boolean).join(" ") || null} />
          <AccountGate
            session={session}
            balanceSource={privateMode ? "private" : source}
            availableBase={privateMode ? (priv.budget?.spendableBase ?? null) : availableBase}
            stakeBase={stakeBase}
            depositBase={privateMode ? 0n : depositBase}
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
          {regionHeld && <RegionNote />}
          <p className="tk-foot">
            {isRange ? RANGE.cta.footnote : routing.armed ? TICKET.footnoteArmed : TICKET.footnote}
            {isRange && rangeReserve?.paused ? ` ${RANGE.ticket.reservePaused}` : null}
            {!isRange && !boosted && walletRoute && funding?.ok && funding.venueCreditUsedBase > 0n ? ` ${TICKET.creditNote(`${formatBaseUnits(funding.venueCreditUsedBase, decimals)} ${symbol}`)}` : null}
            {session.isConnected && depositBase > 0n ? ` ${TICKET.seatDeposit(`${formatBaseUnits(depositBase, decimals)} ${symbol}`)}` : null}
          </p>
        </>
      )}
    </section>
  );
}
