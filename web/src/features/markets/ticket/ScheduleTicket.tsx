"use client";

import { belowMinStake } from "@agari/core/sizing";
import { formatBaseUnits } from "@agari/core/units";
import { X } from "lucide-react";
import { Money } from "@/components/data";
import { BlockedButton } from "@/components/states";
import { Switch } from "@/components/ui/switch";
import { RegionNote } from "@/features/region/RegionNote";
import { PREOPEN, TICKET } from "@/lib/copy";
import { SIDE_WORD } from "../side-styles";
import { AccountGate } from "./AccountGate";
import { AmountBlock } from "./AmountBlock";
import { OutcomeNote } from "./OutcomeNote";
import { PriceControl } from "./PriceControl";
import { plainCells } from "./readout-cells";
import { ReadoutStrip } from "./ReadoutStrip";
import { ScheduledCall } from "./ScheduledCall";
import { BetAgainstToggle } from "./BetAgainstToggle";
import { SideSegments } from "./SideSegments";
import { TicketHeader } from "./TicketHeader";
import { TicketMiniChart } from "./TicketMiniChart";
import type { TicketSelection } from "./types";
import { useScheduleTicket } from "./useScheduleTicket";
import "./preopen.css";
import { useWhen } from "@/lib/when";

interface ScheduleTicketProps {
  selection: TicketSelection;
  /** Present when the ticket is the mobile drawer: it then carries its own head and close, as the reference's does. */
  drawer?: { onClose: () => void };
}

/**
 * The Ticket in schedule mode (D-088): the same panel, block for block — side · amount · the strip · the gates ·
 * the CTA · the footnote — with the live quote replaced by the user's own price and a resting horizon. A listed
 * Window has no book to quote from, so the strip carries what the chain will hold, and the button says "Schedule".
 * Once the call rests, the body is the receipt with its Cancel.
 */
export function ScheduleTicket({ selection, drawer }: ScheduleTicketProps) {
  const when = useWhen();
  const s = useScheduleTicket(selection);
  const { t, symbol, quote } = s;
  const { market, side, stakeBase, phase } = t;
  const decimals = market.decimals;
  const rested = s.bet.state.outcome?.status === "resting" ? s.bet.state.outcome.rested : null;
  const caption = quote ? (s.restUntil === "lock" ? PREOPEN.ticket.restsUntilLock(s.priceCents) : PREOPEN.ticket.rests(s.priceCents)) : s.gridReady ? PREOPEN.ticket.sizing : PREOPEN.ticket.reading;
  const reset = () => {
    s.bet.reset();
    t.setStakeText("");
  };

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
      {rested ? (
        <ScheduledCall rested={rested} market={market} decimals={decimals} symbol={symbol} onAnother={reset} />
      ) : (
        <>
          <p className="tk-caption">
            <span>{PREOPEN.ticket.listed(when(market.tradingStartSec))}</span>
          </p>
          <SideSegments side={side} onSelect={t.selectSide} />
          {/* A-1a: a Listed Window is where a bearish caller rests a price, so the mode is offered here too. */}
          <BetAgainstToggle />
          <AmountBlock
            value={t.stakeText}
            onChange={t.setStakeText}
            stakeBase={stakeBase}
            onStakeBase={t.setStakeBase}
            balanceBase={s.availableBase}
            decimals={decimals}
            symbol={symbol}
            belowMin={stakeBase > 0n && belowMinStake(stakeBase, decimals)}
            leverage={null}
            costBase={quote?.maxCostBase ?? null}
          />
          <PriceControl priceCents={s.priceCents} onChange={s.setPriceCents} side={side} symbol={symbol} />
          <ReadoutStrip cells={plainCells(quote, decimals)} live={quote !== null} caption={caption} chance={quote ? TICKET.chance(s.priceCents) : null} note={s.laneNote} />
          <AccountGate
            session={s.session}
            balanceSource="wallet"
            availableBase={s.availableBase}
            stakeBase={quote?.maxCostBase ?? stakeBase}
            depositBase={s.depositBase}
            decimals={decimals}
            symbol={symbol}
            route={null}
          />
          <label className="tk-rest-until type-caption text-ink-secondary">
            <span>{PREOPEN.ticket.untilLock}</span>
            <Switch size="sm" checked={s.restUntil === "lock"} onCheckedChange={(on) => s.setRestUntil(on ? "lock" : "bell")} />
          </label>
          <p className="tk-note tk-rest-until-note">{PREOPEN.ticket.untilLockNote}</p>
          <OutcomeNote state={s.bet.state} decimals={decimals} symbol={symbol} onDismiss={s.bet.reset} />
          <BlockedButton blocker={s.blocker} ctx={s.ctx} tone={side ?? "primary"} size="lg" className="w-full" onClick={s.place}>
            {side && quote ? (
              <>
                {PREOPEN.ticket.cta(SIDE_WORD[side])} <Money value={quote.maxCostBase} decimals={decimals} symbol={symbol} />
              </>
            ) : (
              PREOPEN.ticket.ctaPlain
            )}
          </BlockedButton>
          {s.blocker === "region" && <RegionNote />}
          <p className="tk-foot">
            {PREOPEN.ticket.footnote(s.bondText)}
            {s.session.isConnected && s.depositBase > 0n ? ` ${TICKET.seatDeposit(`${formatBaseUnits(s.depositBase, decimals)} ${symbol}`)}` : null}
          </p>
        </>
      )}
    </section>
  );
}
