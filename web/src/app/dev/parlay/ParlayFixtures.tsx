"use client";

import Link from "next/link";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { PARLAY, ParlayCard, ParlayTicket, type ParlayTicketProps } from "@/features/parlay";
import "@/features/parlay/parlay-page.css";
import "@/features/parlay/parlay-builder.css";
import "@/features/parlay/parlay-ticket.css";
import { FIXTURE_NOW_MS, FIXTURE_SYMBOL, LEGS, LEGS_CORRELATED, QUOTE, QUOTE_CORRELATED, QUOTE_ERROR, RESERVE, TICKETS, WINDOW_BY_ID } from "./fixtures";

const noop = () => undefined;

const BASE: ParlayTicketProps = {
  legs: LEGS,
  marketOf: (leg) => WINDOW_BY_ID.get(leg.marketId) ?? null,
  reserve: RESERVE,
  symbol: FIXTURE_SYMBOL,
  nowMs: FIXTURE_NOW_MS,
  quote: QUOTE,
  quoteLoading: false,
  quoteError: null,
  onRetryQuote: noop,
  solveMode: "fixStake",
  onSolveMode: noop,
  stakeInput: "28.22",
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

const TICKET_STATES: Array<{ label: string; props: Partial<ParlayTicketProps> }> = [
  { label: "Fewer than two legs", props: { legs: LEGS.slice(0, 1), quote: null } },
  { label: "Pricing", props: { quote: null, quoteLoading: true } },
  { label: "Quoted — set stake", props: {} },
  { label: "Quoted — set payout", props: { solveMode: "fixPayout" } },
  { label: "Correlated legs", props: { legs: LEGS_CORRELATED, quote: QUOTE_CORRELATED } },
  { label: "The reserve refused the quote", props: { quote: null, quoteError: QUOTE_ERROR } },
  { label: "Not enough in the wallet", props: { walletSpendableBase: 3n * 10n ** 6n } },
  { label: "Placing", props: { step: "placing" } },
  { label: "Placed", props: { step: "success", txHash: "0x8d8a1b56b7c2e9d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7" } },
  { label: "Requote after the book moved", props: { step: "error", errorTitle: "The book moved", errorDetail: PARLAY.ticket.requote("29.71", FIXTURE_SYMBOL) } },
  { label: "Reverted", props: { step: "error", errorTitle: "The contract refused", errorDetail: "OverExposure(612000000, 1000000000, 6000)" } },
  { label: "Reserve paused", props: { reserve: { ...RESERVE, paused: true } } },
];

/** Every slip card and every ticket state from canned readings through the real components; the live page is `/parlay` itself. */
export function ParlayFixtures() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-8 px-gutter py-8 lg:px-gutter-desktop">
      <SectionHeader index="01" title={`${PARLAY.devTitle} · slip cards`} />
      <FixtureGrid>
        {TICKETS.map(({ label, ticket }) => (
          <Fixture key={label} label={label}>
            <ParlayCard ticket={ticket} nowMs={FIXTURE_NOW_MS} symbol={FIXTURE_SYMBOL} decimals={RESERVE.decimals} busy={null} onClaim={noop} onSettle={noop} />
          </Fixture>
        ))}
      </FixtureGrid>

      <SectionHeader index="02" title={`${PARLAY.devTitle} · the ticket`} />
      <FixtureGrid>
        {TICKET_STATES.map(({ label, props }) => (
          <Fixture key={label} label={label}>
            <ParlayTicket {...BASE} {...props} />
          </Fixture>
        ))}
      </FixtureGrid>

      <SectionHeader index="03" title="Live" />
      <p className="type-caption text-ink-secondary">
        The builder reads the venue and the reserve; open it at{" "}
        <Link href="/parlay" className="text-ink underline decoration-dotted underline-offset-4 hover:text-accent">
          /parlay
        </Link>
        .
      </p>
    </div>
  );
}
