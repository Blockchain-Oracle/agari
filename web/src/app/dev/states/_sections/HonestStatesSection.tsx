"use client";

import { SectionHeader } from "@/components/chrome";
import { Money, UtcTime } from "@/components/data";
import { BlockedButton, EmptyState, ErrorState, LoadingState, ReadingBoundary } from "@/components/states";
import { BLOCKER_KINDS, EMPTY } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { DECIMALS, DIAGNOSES, FAILED_BALANCE, FIXED_NOW_MS, LIVE_BALANCE, STALE_BALANCE, SYMBOL } from "../fixtures";
import { Fixture, FixtureGrid } from "./Fixture";

const BLOCKER_SAMPLE = BLOCKER_KINDS.filter((k) => k !== "connecting" && k !== "placing");

export function HonestStatesSection() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader index="02" title="Honest states" eyebrow="every surface is in exactly one" />
      <FixtureGrid>
        <Fixture label="Loading — skeleton only where nothing was ever known">
          <LoadingState shape="row" />
          <LoadingState shape="plate" />
          <LoadingState shape="ticket" />
        </Fixture>
        <Fixture label="Live">
          <ReadingBoundary reading={LIVE_BALANCE}>
            {(value, meta) => (
              <div className="flex flex-col gap-1">
                <Money value={value} decimals={DECIMALS} symbol={SYMBOL} className="type-data-hero text-ink" />
                <UtcTime ms={meta.asOfMs} className="type-caption text-ink-secondary" />
              </div>
            )}
          </ReadingBoundary>
        </Fixture>
        <Fixture label="Stale-last-good — full ink, warning tick, never 0">
          <ReadingBoundary reading={STALE_BALANCE}>
            {(value) => <Money value={value} decimals={DECIMALS} symbol={SYMBOL} className="type-data-hero text-ink" />}
          </ReadingBoundary>
        </Fixture>
        <Fixture label="Empty-with-explanation">
          <EmptyState why={EMPTY.positions.why} nextAction={{ label: EMPTY.positions.nextAction, href: "/markets" }} />
        </Fixture>
        <Fixture label="Blocked-with-reason — the blocker is the label">
          <div className="flex flex-col gap-2">
            {BLOCKER_SAMPLE.map((kind) => (
              <BlockedButton
                key={kind}
                blocker={kind}
                ctx={{ quotedCents: kind === "outside-band-low" ? 1 : 98, nextStartText: "0:42", cadence: "5m", quoteAgeSec: 14 }}
                className="w-full justify-start"
              >
                {kind}
              </BlockedButton>
            ))}
            <BlockedButton blocker={null} tone="up" size="lg" className="w-full" onClick={() => notify.neutral("UP armed")}>
              UP · 10 {SYMBOL}
            </BlockedButton>
            <BlockedButton blocker={null} tone="down" size="lg" className="w-full" onClick={() => notify.neutral("DOWN armed")}>
              DOWN · 10 {SYMBOL}
            </BlockedButton>
          </div>
        </Fixture>
        <Fixture label="Error — human words, last-good retained, technical details below">
          <div className="flex flex-col gap-3">
            <ReadingBoundary reading={FAILED_BALANCE} retry={() => notify.neutral("Retry requested")}>
              {(value) => <Money value={value} decimals={DECIMALS} />}
            </ReadingBoundary>
            {DIAGNOSES.slice(0, 2).map((d) => (
              <ErrorState key={d.kind} diagnosis={d} />
            ))}
            <ErrorState variant="boundary" diagnosis={DIAGNOSES[0]!} retry={() => notify.neutral("Reset")} backHref="/" />
          </div>
        </Fixture>
      </FixtureGrid>
      <p className="type-caption text-ink-muted">
        Fixed clock: <UtcTime ms={FIXED_NOW_MS} withDate />
      </p>
    </section>
  );
}
