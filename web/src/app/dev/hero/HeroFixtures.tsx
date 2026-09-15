"use client";

import { LAUNCH_TICKERS } from "@agari/core/market";
import { ok } from "@agari/core/schemas";
import { SectionHeader } from "@/components/chrome";
import { HeroAssetChartView } from "@/features/markets/hero/HeroAssetChart";
import { NextWindowCardView } from "@/features/markets/lanes/NextWindowCard";
import { MarketSessionChipView } from "@/features/markets/session";
import { TicketPlaceholderView } from "@/features/markets/ticket/TicketPlaceholder";
import { Fixture, FixtureGrid } from "../states/_sections/Fixture";
import { HERO_FIXTURES, NEXT_WINDOW_CADENCES, type HeroFixture } from "./fixtures";

const DEV = {
  title: "The closed market",
  intro:
    "The asset hero, the ticket rail, the next-Window cards and the session chip at the /dev/session clocks — pre-market, after hours, the weekend and a holiday — over a canned signed-archive session. The same views /markets renders when no Window is live (D-086/D-087).",
  hero: "hero + rail — as /markets lays them out",
  cards: "next-Window cards — 5m and 60m lanes",
  chip: "session chip — header and hero",
} as const;

const noop = () => undefined;

function ClosedHero({ fixture }: { fixture: HeroFixture }) {
  const { asset, session, nowSec, history } = fixture;
  return (
    <div className="flex flex-col gap-4">
      <Fixture label={DEV.hero}>
        {/* `.markets-hero` scopes Masayume's mini-hero grid (the fixed rail column, the chart's height floor, the top-aligned rail on desktop). */}
        <div className="markets-hero">
          <div className="hero-grid hero-grid-mini">
            <HeroAssetChartView asset={asset} tickers={LAUNCH_TICKERS} onPickAsset={noop} session={session} history={ok(history, nowSec * 1000)} nowSec={nowSec} range="1D" onRange={noop} />
            <TicketPlaceholderView asset={asset} session={session} nowSec={nowSec} />
          </div>
        </div>
      </Fixture>
      <FixtureGrid>
        <Fixture label={DEV.cards}>
          <div className="markets-grid markets-grid-live">
            {NEXT_WINDOW_CADENCES.map((intervalSec) => (
              <NextWindowCardView key={intervalSec} asset={asset} basis="regular" intervalSec={intervalSec} session={session} nowSec={nowSec} history={history} />
            ))}
          </div>
        </Fixture>
        <Fixture label={DEV.chip}>
          <div className="flex flex-col gap-3">
            <MarketSessionChipView session={session} asset={asset} nowSec={nowSec} />
            <div className="mh-asset-row">
              <MarketSessionChipView session={session} asset={asset} nowSec={nowSec} />
            </div>
            <p className="type-caption text-ink-muted">
              {session.status.state} · {session.label}
            </p>
          </div>
        </Fixture>
      </FixtureGrid>
    </div>
  );
}

/** stage-18 18a: `/dev/hero` fixtures at `CLOCK.preTue/postTue/weekendSat/holidayThu`. */
export function HeroFixtures() {
  return (
    <section className="flex flex-col gap-6">
      <SectionHeader index="S18" title={DEV.title} />
      <p className="type-body text-ink-secondary">{DEV.intro}</p>
      {HERO_FIXTURES.map((fixture) => (
        <section key={fixture.label} className="flex flex-col gap-3">
          <h3 className="type-label-micro text-ink-muted">{fixture.label}</h3>
          <ClosedHero fixture={fixture} />
        </section>
      ))}
    </section>
  );
}
