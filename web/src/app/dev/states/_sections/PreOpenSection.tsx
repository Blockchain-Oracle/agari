"use client";

import { restingQuote } from "@agari/core/orders";
import { useState } from "react";
import { SectionHeader } from "@/components/chrome";
import { Money } from "@/components/data";
import { BlockedButton } from "@/components/states";
import { ListedCard } from "@/features/markets/lanes/ListedCard";
import { BetAgainstToggle } from "@/features/markets/ticket/BetAgainstToggle";
import { ScheduledCallView } from "@/features/markets/ticket/ScheduledCall";
import { SideSegments } from "@/features/markets/ticket/SideSegments";
import { DEFAULT_PRICE_CENTS, PriceControl } from "@/features/markets/ticket/PriceControl";
import { plainCells } from "@/features/markets/ticket/readout-cells";
import { ReadoutStrip } from "@/features/markets/ticket/ReadoutStrip";
import { deriveScheduleBlocker, type ScheduleBlockerInput } from "@/features/markets/ticket/schedule-guards";
import { RestingRowView } from "@/features/markets/portfolio/RestingRows";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PREOPEN, TICKET } from "@/lib/copy";
import { fixtureGapWindow } from "../../fixture-window";
import { DECIMALS, SYMBOL } from "../fixtures";
import { GAP_LISTED, REGULAR_UPCOMING } from "../lane-fixtures";
import { RESTED_UP, RESTING_ROWS } from "../preopen-fixtures";
import { Fixture, FixtureGrid } from "./Fixture";

const noop = () => undefined;
/** A devnet Series grid: 1,000-base lots, 1-base ticks, a cash unit of 1, `min_lots` 1,000, a 0.25 tUSDC bond. */
const GRID = { lotBase: 1_000n, tickBase: 1n, cashUnit: 1n, minLots: 1_000n };
const STAKE = 5_500_000n;
const SESSION = { isConnected: true, isConnecting: false, isRightChain: true, address: null } as unknown as ScheduleBlockerInput["session"];
const READY: ScheduleBlockerInput = {
  session: SESSION,
  hasSigner: true,
  placing: false,
  phase: "upcoming",
  lane: { basis: "regular", sessionOpen: false, halt: null, laneState: null },
  side: "up",
  priceCents: 55,
  stakeBase: STAKE,
  availableBase: 12_000_000n,
  depositBase: 250_000n,
  sized: restingQuote({ side: "up", priceCents: 55, stakeBase: STAKE, grid: GRID, decimals: DECIMALS, quotedAtMs: 0 }),
  crossing: null,
  restingCount: 0,
  funding: null,
};
const LADDER: ReadonlyArray<{ label: string; input: ScheduleBlockerInput; ctx?: Parameters<typeof BlockedButton>[0]["ctx"] }> = [
  { label: "ready — Schedule UP for the escrow", input: READY },
  { label: "rest-would-cross — the book already offers DOWN at 45¢", input: { ...READY, crossing: { otherSide: "down", otherCents: 45, maxCents: 54 } }, ctx: { crossingText: PREOPEN.ticket.crossing(SIDE_WORD.down, 45, SIDE_WORD.up, 54) } },
  { label: "too-many-resting — the seat's 16 calls", input: { ...READY, restingCount: 16 } },
  {
    label: "below-min-stake — 0.30 tUSDC rests fewer than 1,000 lots at 55¢",
    input: { ...READY, stakeBase: 300_000n, sized: restingQuote({ side: "up", priceCents: 55, stakeBase: 300_000n, grid: GRID, decimals: DECIMALS, quotedAtMs: 0 }) },
    ctx: { minStakeText: `0.55 ${SYMBOL}` },
  },
  { label: "over-balance — escrow plus the seat bond past the balance", input: { ...READY, availableBase: 5_600_000n } },
];

function ScheduleComposer() {
  const [priceCents, setPriceCents] = useState(DEFAULT_PRICE_CENTS);
  const sized = restingQuote({ side: "up", priceCents, stakeBase: STAKE, grid: GRID, decimals: DECIMALS, quotedAtMs: 0 });
  const quote = sized.ok ? sized.quote : null;
  return (
    <div className="tk-ticket tk-ticket--rail flex flex-col gap-3">
      <PriceControl priceCents={priceCents} onChange={setPriceCents} side="up" symbol={SYMBOL} />
      <ReadoutStrip cells={plainCells(quote, DECIMALS)} live={quote !== null} caption={quote ? PREOPEN.ticket.rests(priceCents) : PREOPEN.ticket.sizing} chance={quote ? TICKET.chance(priceCents) : null} />
      <BlockedButton blocker={null} ctx={{}} tone="up" size="lg" className="w-full" onClick={noop}>
        {PREOPEN.ticket.cta(SIDE_WORD.up)} {quote && <Money value={quote.maxCostBase} decimals={DECIMALS} symbol={SYMBOL} />}
      </BlockedButton>
      <p className="tk-foot">{PREOPEN.ticket.footnote(`0.25 ${SYMBOL}`)}</p>
    </div>
  );
}

/** D-088: the scheduled call on every surface it touches, from canned Windows, orders and books. */
export function PreOpenSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader index="S18" title="Pre-open calls" eyebrow="listed card, schedule ticket, receipt, resting rows" />
      <FixtureGrid>
        <Fixture label="Listed card — a Regular Window before Tuesday's open (schedules a call)">
          <div className="markets-grid markets-grid-live">
            <ListedCard market={REGULAR_UPCOMING} selected={false} onSelect={noop} />
          </div>
        </Fixture>
        <Fixture label="Listed card — the 09-18 Gap before Friday's close (its own words, the same strip)">
          <div className="markets-grid markets-grid-live">
            <ListedCard market={fixtureGapWindow({ marketId: GAP_LISTED.marketId, decimals: DECIMALS, status: "Listed" })} selected={false} onSelect={noop} />
          </div>
        </Fixture>
        <Fixture label="Schedule ticket — the price control, the strip and the CTA on a 5.50 tUSDC stake (live control)">
          <ScheduleComposer />
        </Fixture>
        {/* A-1a: the bearish mode, with the side control it reorders. Live: the switch writes this browser's own choice. */}
        <Fixture label="Betting against — the switch and the sides it reorders (live control)">
          <div className="tk-ticket tk-ticket--rail flex flex-col gap-3">
            <SideSegments side={null} onSelect={noop} />
            <BetAgainstToggle />
          </div>
        </Fixture>
        <Fixture label="Schedule ticket — the blocker ladder">
          <div className="flex flex-col gap-2">
            {LADDER.map(({ label, input, ctx }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="type-label-micro text-ink-muted">{label}</span>
                <BlockedButton blocker={deriveScheduleBlocker(input)} ctx={ctx ?? {}} tone="up" className="w-full justify-start" onClick={noop}>
                  {PREOPEN.ticket.cta(SIDE_WORD.up)} <Money value={READY.sized!.ok ? READY.sized!.quote.maxCostBase : 0n} decimals={DECIMALS} symbol={SYMBOL} />
                </BlockedButton>
              </div>
            ))}
          </div>
        </Fixture>
        <Fixture label="Scheduled call — the receipt in the ticket, Cancel live">
          <div className="tk-ticket tk-ticket--rail">
            <ScheduledCallView rested={RESTED_UP} market={REGULAR_UPCOMING} decimals={DECIMALS} symbol={SYMBOL} cancel={{ busy: false, note: null, done: false, onCancel: noop }} onAnother={noop} />
          </div>
        </Fixture>
        <Fixture label="Scheduled call — cancelled">
          <div className="tk-ticket tk-ticket--rail">
            <ScheduledCallView rested={RESTED_UP} market={REGULAR_UPCOMING} decimals={DECIMALS} symbol={SYMBOL} cancel={{ busy: false, note: PREOPEN.receipt.cancelled, done: true, onCancel: noop }} onAnother={noop} />
          </div>
        </Fixture>
      </FixtureGrid>
      <Fixture label="Portfolio · Open — resting rows, from idx_orders rows through core restingOrderView">
        <div className="bets-plate">
          <ul className="bets-list">
            {RESTING_ROWS.map(({ label, view }) => (
              <RestingRowView key={label} view={view} symbol={SYMBOL} cancel={view.handle && (view.status === "resting" || view.status === "resting-for-open") ? { busy: false, note: null, onCancel: noop } : null} />
            ))}
          </ul>
        </div>
      </Fixture>
    </section>
  );
}
