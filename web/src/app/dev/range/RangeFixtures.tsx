"use client";

import Link from "next/link";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { BandControl, RANGE, RangeCard, RangeTicket, useRangeDraft, type RangeTicketProps } from "@/features/range";
import "@/features/parlay/parlay-page.css";
import "@/features/parlay/parlay-builder.css";
import "@/features/parlay/parlay-ticket.css";
import "@/features/range/range-band.css";
import "@/features/range/range-page.css";
import { FIXTURE_NOW_MS, FIXTURE_SYMBOL, OPENING, QUOTE, QUOTE_ERROR, RESERVE, ROUNDS, WINDOW } from "./fixtures";

const noop = () => undefined;

const BASE: RangeTicketProps = {
  window: WINDOW,
  side: "inside",
  lowUsd: 76_705,
  highUsd: 76_765,
  reserve: RESERVE,
  symbol: FIXTURE_SYMBOL,
  nowMs: FIXTURE_NOW_MS,
  quote: QUOTE,
  quoteLoading: false,
  quoteError: null,
  onRetryQuote: noop,
  solveMode: "fixPayout",
  onSolveMode: noop,
  stakeInput: "35.39",
  onStakeInput: noop,
  payoutInput: "100",
  onPayoutInput: noop,
  walletSpendableBase: 240n * 10n ** 6n,
  step: "idle",
  errorTitle: "",
  errorDetail: "",
  txHash: null,
  onPlace: noop,
  onReset: noop,
};

const TICKET_STATES: Array<{ label: string; props: Partial<RangeTicketProps> }> = [
  { label: "No Window yet", props: { window: null, quote: null } },
  { label: "Pricing", props: { quote: null, quoteLoading: true } },
  { label: "Quoted — set payout", props: {} },
  { label: "Quoted — outside", props: { side: "outside", quote: { ...QUOTE, side: "outside", probRaw: 684_054n, stakeBase: 76_614_048n, multiplierMilli: 1_305 } } },
  { label: "The reserve refused the quote", props: { quote: null, quoteError: QUOTE_ERROR } },
  { label: "Not enough in the wallet", props: { walletSpendableBase: 3n * 10n ** 6n } },
  { label: "Placing", props: { step: "placing" } },
  { label: "Placed", props: { step: "success", txHash: "0x8d8a1b56b7c2e9d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7" } },
  { label: "Requote after the basis moved", props: { step: "error", errorTitle: "The book moved", errorDetail: RANGE.ticket.requote("36.10", FIXTURE_SYMBOL) } },
  { label: "Reserve paused", props: { reserve: { ...RESERVE, paused: true } } },
];

function Band() {
  const draft = useRangeDraft(OPENING + 1_200n, 300);
  return <BandControl asset="BTC" intervalSec={300} draft={draft} side="inside" onSide={noop} />;
}

function BandWaiting() {
  const draft = useRangeDraft(null, 3600);
  return <BandControl asset="ETH" intervalSec={3600} draft={draft} side="inside" />;
}

/** `/dev/range` — the band control, the ticket's states and the slip's cards on canned readings. Scaffolding: never linked from the app. */
export function RangeFixtures() {
  return (
    <div className="container pl-page">
      <SectionHeader index="00" eyebrow="Fixtures" title={RANGE.devTitle} />
      <p className="type-caption text-ink-muted">
        Canned readings only. The live page is <Link href="/games/range">/games/range</Link>.
      </p>
      <FixtureGrid>
        <Fixture label="Band — live spot, drag or arrow keys">
          <Band />
        </Fixture>
        <Fixture label="Band — waiting for the oracle price, hourly cadence">
          <BandWaiting />
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        {TICKET_STATES.map(({ label, props }) => (
          <Fixture key={label} label={label}>
            <RangeTicket {...BASE} {...props} />
          </Fixture>
        ))}
      </FixtureGrid>
      <FixtureGrid>
        {ROUNDS.map((round) => (
          <Fixture key={round.roundId.toString()} label={`Round · ${round.status}${round.settledOnchain && round.status === "live" ? " · settle pill" : ""}`}>
            <RangeCard round={round} nowMs={FIXTURE_NOW_MS} symbol={FIXTURE_SYMBOL} decimals={6} staleAfterSec={21_600} busy={null} onClaim={noop} onSettle={noop} onVoidStale={noop} />
          </Fixture>
        ))}
      </FixtureGrid>
    </div>
  );
}
