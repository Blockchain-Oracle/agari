"use client";

import { SectionHeader } from "@/components/chrome";
import { MarketSessionChipView } from "@/features/markets/session";
import { Fixture, FixtureGrid } from "../states/_sections/Fixture";
import { SESSION_STATES } from "./market-session-fixtures";

const DEV = {
  title: "Market session",
  intro: "The NYSE session chip in every S6 state from canned calendars and halts — the same value a live /session read builds.",
} as const;

/** session-lanes.md §5 "Session chip": pre, regular, early close, halted (both wordings), post, closed, holiday. */
export function MarketSessionFixtures() {
  return (
    <section className="mx-auto flex w-full max-w-(--content-reading) flex-col gap-4 px-gutter pt-8">
      <SectionHeader index="S6" title={DEV.title} />
      <p className="type-body text-ink-secondary">{DEV.intro}</p>
      <FixtureGrid>
        {SESSION_STATES.map(({ label, session, nowSec, asset }) => (
          <Fixture key={label} label={label}>
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
        ))}
      </FixtureGrid>
    </section>
  );
}
