"use client";

import { boostSheet, parlaySheet, rangeSheet } from "@agari/core/reserves";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { boostBounds, parlayBounds, PositionCard, rangeBounds, ReserveBounds, ReservePanel, RESERVES, SupplyCard } from "@/features/earn";
import { RESERVE as BOOST } from "@/app/dev/leverage/fixtures";
import { RESERVE as PARLAY } from "@/app/dev/parlay/fixtures";
import { RESERVE as RANGE } from "@/app/dev/range/fixtures";
import { FIXTURE_SYMBOL } from "./fixtures";

const noop = () => undefined;
const UNIT = 10n ** 6n;

const TABS = [
  { words: RESERVES.range, sheet: rangeSheet(RANGE), rows: rangeBounds(RANGE, rangeSheet(RANGE), RESERVES.range, FIXTURE_SYMBOL) },
  { words: RESERVES.parlay, sheet: parlaySheet(PARLAY), rows: parlayBounds(PARLAY, parlaySheet(PARLAY), RESERVES.parlay, FIXTURE_SYMBOL) },
  { words: RESERVES.boost, sheet: boostSheet(BOOST), rows: boostBounds(BOOST, boostSheet(BOOST), RESERVES.boost, FIXTURE_SYMBOL) },
] as const;

/** `/dev/earn` — the three house-reserve tabs on the same canned reserves the range, parlay and boost fixtures use. */
export function ReserveTabFixtures() {
  return (
    <>
      {TABS.map(({ words, sheet, rows }) => (
        <div key={words.key}>
          <SectionHeader index="00" eyebrow="Fixtures" title={words.label} />
          <FixtureGrid>
            <Fixture label={`Panel — ${words.key}`}>
              <ReservePanel sheet={sheet} symbol={FIXTURE_SYMBOL} words={words} />
            </Fixture>
            <Fixture label={`Panel — ${words.key}, paused`}>
              <ReservePanel sheet={{ ...sheet, paused: true }} symbol={FIXTURE_SYMBOL} words={words} />
            </Fixture>
            <Fixture label="Supply — 240 in the wallet">
              <SupplyCard connected sheet={sheet} symbol={FIXTURE_SYMBOL} walletBase={240n * UNIT} busy={null} onSupply={noop} onMessage={noop} />
            </Fixture>
            <Fixture label="Position — part committed">
              <PositionCard connected sheet={sheet} words={words} symbol={FIXTURE_SYMBOL} shares={500n * UNIT} worthBase={500_022_000n} busy={null} onWithdraw={noop} />
            </Fixture>
          </FixtureGrid>
          <Fixture label="Bounds — the deployed reserve's own parameters">
            <ReserveBounds rows={rows} risk={words.risk} />
          </Fixture>
        </div>
      ))}
    </>
  );
}
