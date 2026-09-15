"use client";

import { phase } from "@agari/core/lifecycle";
import type { EventMarket, Lane, LaneBasis } from "@agari/core/types";
import { useState } from "react";
import { SectionHeader } from "@/components/chrome";
import { BlockedButton } from "@/components/states";
import { ClaimRow } from "@/features/markets/claims";
import { PriceSourceNote } from "@/features/markets/hero";
import { LaneTabs, PausedCard } from "@/features/markets/lanes";
import { laneTabKey, type LaneTabKey } from "@/features/markets/lanes/lane-view";
import { MarketCardView } from "@/features/markets/lanes/MarketCardView";
import { laneBlocker } from "@/features/markets/ticket/ticket-guards";
import { laneGuardOf } from "@/features/markets/ticket/useLaneGuard";
import { ReadoutStrip } from "@/features/markets/ticket/ReadoutStrip";
import { ClaimWinnings } from "@/features/markets/verdict/ClaimWinnings";
import { TICKET } from "@/lib/copy";
import { VOID_ROW } from "../../claims/fixtures";
import { fixtureGapWindow } from "../../fixture-window";
import { CLOCK, fixtureSession, HALTS } from "../../session/market-session-fixtures";
import { VERDICT_FIXTURES } from "../../verdict/fixtures";
import { SYMBOL } from "../fixtures";
import { GAP_CARDS, GAP_LISTED, PAUSED_CARDS, PAUSED_UPCOMING, REGULAR_SETTLED, REGULAR_TRADING, REGULAR_UPCOMING, TOKEN_CARD, TOKEN_WINDOW, VOID_DETAILS, type CardFixture } from "../lane-fixtures";
import { Fixture, FixtureGrid } from "./Fixture";

const noop = () => undefined;
const lane = (basis: LaneBasis, intervalSec: number, markets: EventMarket[]): Lane => ({ basis, intervalSec, label: "", markets, nextStartSec: null });
const TAB_LANES: Lane[] = [lane("regular", 300, [REGULAR_TRADING]), lane("regular", 900, []), lane("regular", 3_600, []), lane("gap", 604_800, [GAP_CARDS[1]!.market]), lane("token", 300, [TOKEN_WINDOW])];
const QQQ_GAP_LISTED = fixtureGapWindow({ marketId: GAP_LISTED.marketId, asset: "QQQ", decimals: 6, status: "Listed" });
const NVDA_GAP = fixtureGapWindow({ marketId: GAP_LISTED.marketId, asset: "NVDA", decimals: 6, openingPriceRaw: 21_128_480_000n });

/** A Window read by the ticket's lane guard at a clock, as the live ticket reads it. */
const BLOCKERS = [
  { label: "session-closed — before the open", market: REGULAR_UPCOMING, nowSec: CLOCK.preTue, session: fixtureSession(CLOCK.preTue) },
  { label: "session-closed — a settled Window after the close", market: REGULAR_SETTLED, nowSec: CLOCK.postTue, session: fixtureSession(CLOCK.postTue) },
  { label: "halted — pyth-wide", market: REGULAR_TRADING, nowSec: CLOCK.regularTue, session: fixtureSession(CLOCK.regularTue, { halts: HALTS, asset: "TSLA" }) },
  { label: "halted — pyth-stale (Q-S6-9)", market: REGULAR_TRADING, nowSec: CLOCK.regularTue, session: fixtureSession(CLOCK.regularTue, { halts: { TSLA: { reason: "pyth-stale", sinceSec: CLOCK.regularTue - 20 } }, asset: "TSLA" }) },
  { label: "lane-paused — QQQ Gap with no signed source", market: QQQ_GAP_LISTED, nowSec: CLOCK.listedWed, session: fixtureSession(CLOCK.listedWed) },
  { label: "gap-listed — TSLA Gap before Friday's close", market: GAP_LISTED, nowSec: CLOCK.listedWed, session: fixtureSession(CLOCK.listedWed) },
  { label: "corporate-action — NVDA split day", market: PAUSED_UPCOMING, nowSec: CLOCK.regularTue, session: fixtureSession(CLOCK.regularTue) },
  { label: "halted — TSLAx issuer halt on the weekend token lane", market: TOKEN_WINDOW, nowSec: CLOCK.weekendSat, session: fixtureSession(CLOCK.weekendSat, { halts: HALTS, asset: "TSLAx" }) },
];

const EARNINGS = [
  { label: "earnings — a Regular Window on report day", market: REGULAR_TRADING, session: fixtureSession(CLOCK.regularTue) },
  { label: "earnings — a Gap over an after-close Friday", market: NVDA_GAP, session: fixtureSession(CLOCK.weekendSat) },
];

function Card({ fixture }: { fixture: CardFixture }) {
  return (
    <Fixture label={fixture.label}>
      <div className="markets-grid markets-grid-live">
        <MarketCardView market={fixture.market} nowMs={fixture.nowMs} selected={false} onSelect={noop} onOpenRoom={noop} {...fixture.data} />
      </div>
      <PriceSourceNote market={fixture.market} />
    </Fixture>
  );
}

/** session-lanes.md §5: every S6 lane state on the components `/markets` renders, from canned Windows and sessions. */
export function SessionLanesSection() {
  const [tab, setTab] = useState<LaneTabKey>(laneTabKey("gap", 604_800));
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader index="S6" title="Session lanes" eyebrow="Gap, 24/7 token, halted, paused, closed, void" />
      <Fixture label="Lane tabs — 5m · 15m · 1h · Gap · 5m · 24/7, keyed by basis and cadence">
        <LaneTabs lanes={TAB_LANES} activeKey={tab} pinnedMissingKey={null} onPin={setTab} />
      </Fixture>
      <FixtureGrid>
        {[...GAP_CARDS, TOKEN_CARD].map((fixture) => (
          <Card key={fixture.label} fixture={fixture} />
        ))}
        {PAUSED_CARDS.map((p) => (
          <Fixture key={p.label} label={p.label}>
            <div className="markets-grid markets-grid-live">
              <PausedCard asset={p.asset} basis={p.basis} intervalSec={p.intervalSec} state={p.state} />
            </div>
          </Fixture>
        ))}
      </FixtureGrid>
      <FixtureGrid>
        <Fixture label="Ticket blockers — the lane guard over a Window and a session">
          <div className="flex flex-col gap-2">
            {BLOCKERS.map(({ label, market, nowSec, session }) => {
              const guard = laneGuardOf(market, session);
              return (
                <div key={label} className="flex flex-col gap-1">
                  <span className="type-label-micro text-ink-muted">{label}</span>
                  <BlockedButton blocker={laneBlocker(phase(market, nowSec * 1000), guard.lane)} ctx={guard.ctx} className="w-full justify-start">
                    {TICKET.buyPlain}
                  </BlockedButton>
                </div>
              );
            })}
          </div>
        </Fixture>
        <Fixture label="Earnings — a warning line under the strip, never a blocker">
          {EARNINGS.map(({ label, market, session }) => (
            <div key={label} className="tk-ticket tk-ticket--rail flex flex-col gap-2">
              <span className="type-label-micro text-ink-muted">{label}</span>
              <ReadoutStrip cells={{ cost: null, ret: null, loss: null }} live={false} caption={TICKET.enterAmount} chance={null} note={laneGuardOf(market, session).earnings} />
            </div>
          ))}
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        {VOID_DETAILS.map(({ label, detail }) => (
          <Fixture key={label} label={`Void claim — ${label}`}>
            <ClaimWinnings verdict={VERDICT_FIXTURES.void} marketId={VOID_ROW.marketId} symbol={SYMBOL} voidDetail={detail} />
            <ul>
              <ClaimRow row={VOID_ROW} voidDetail={detail} />
            </ul>
          </Fixture>
        ))}
      </FixtureGrid>
    </section>
  );
}
