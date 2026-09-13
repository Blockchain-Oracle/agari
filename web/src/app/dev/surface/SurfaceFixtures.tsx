"use client";

import { bookStructure } from "@masayume/core/surface";
import Link from "next/link";
import { Fixture, FixtureGrid } from "@/app/dev/states/_sections/Fixture";
import { SectionHeader } from "@/components/chrome";
import { BookReadout, DepthChart, SlippageLadder, SURFACE, TermStructure } from "@/features/surface";
import "@/features/surface/surface-page.css";
import { CROSSED, EMPTY, FIXTURE_DECIMALS, FIXTURE_LOT, FIXTURE_NOW_MS, FIXTURE_SYMBOL, MARKET, MARKET_NO_PRINT, ONE_SIDED, POINTS, SPOT_RAW, THIN, TWO_SIDED } from "./fixtures";

const noop = () => undefined;

/** `/dev/surface` — the book tiles, the depth chart, the ladder and the term structure on canned books. Scaffolding: never linked from the app. */
export function SurfaceFixtures() {
  return (
    <div className="container sf-page">
      <SectionHeader index="00" eyebrow="Fixtures" title={SURFACE.devTitle} />
      <p className="type-caption text-ink-muted">
        Canned books only. The live page is <Link href="/surface">/surface</Link>.
      </p>
      <FixtureGrid>
        <Fixture label="§01 — two-sided book, print in, UP winning">
          <BookReadout market={MARKET} structure={bookStructure(TWO_SIDED)} hydrating={false} openingRaw={MARKET.openingPriceRaw} spotRaw={SPOT_RAW} nowMs={FIXTURE_NOW_MS} />
        </Fixture>
        <Fixture label="§01 — asks only, no print yet, no live price">
          <BookReadout market={MARKET_NO_PRINT} structure={bookStructure(ONE_SIDED)} hydrating={false} openingRaw={null} spotRaw={null} nowMs={FIXTURE_NOW_MS} />
        </Fixture>
        <Fixture label="§01 — hydrating">
          <BookReadout market={MARKET} structure={null} hydrating openingRaw={MARKET.openingPriceRaw} spotRaw={SPOT_RAW} nowMs={FIXTURE_NOW_MS} />
        </Fixture>
        <Fixture label="§01 — crossed: the maker's ladder mid-requote">
          <BookReadout market={MARKET} structure={bookStructure(CROSSED)} hydrating={false} openingRaw={MARKET.openingPriceRaw} spotRaw={SPOT_RAW} nowMs={FIXTURE_NOW_MS} />
        </Fixture>
        <Fixture label="§01 — empty book">
          <BookReadout market={MARKET} structure={bookStructure(EMPTY)} hydrating={false} openingRaw={MARKET.openingPriceRaw} spotRaw={SPOT_RAW} nowMs={FIXTURE_NOW_MS} />
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        <Fixture label="§02 — two-sided depth">
          <DepthChart depth={TWO_SIDED} hydrating={false} />
        </Fixture>
        <Fixture label="§02 — one-sided">
          <DepthChart depth={ONE_SIDED} hydrating={false} />
        </Fixture>
        <Fixture label="§02 — thin pair, then crossed">
          <div className="flex flex-col gap-3">
            <DepthChart depth={THIN} hydrating={false} />
            <DepthChart depth={CROSSED} hydrating={false} />
          </div>
        </Fixture>
        <Fixture label="§02 — empty, then hydrating">
          <div className="flex flex-col gap-3">
            <DepthChart depth={EMPTY} hydrating={false} />
            <DepthChart depth={null} hydrating />
          </div>
        </Fixture>
      </FixtureGrid>
      <FixtureGrid>
        <Fixture label="§03 — the ladder on the two-sided book, no fee">
          <SlippageLadder depth={TWO_SIDED} hydrating={false} symbol={FIXTURE_SYMBOL} lotRaw={FIXTURE_LOT} feeBps={0} />
        </Fixture>
        <Fixture label="§03 — thin pair, 100 bps fee; then waiting on the lot">
          <div className="flex flex-col gap-3">
            <SlippageLadder depth={THIN} hydrating={false} symbol={FIXTURE_SYMBOL} lotRaw={FIXTURE_LOT} feeBps={100} />
            <SlippageLadder depth={TWO_SIDED} hydrating={false} symbol={FIXTURE_SYMBOL} lotRaw={null} feeBps={null} />
          </div>
        </Fixture>
      </FixtureGrid>
      <Fixture label="§04 — five Windows: priced, priced, crossed, failed, one-sided">
        <TermStructure points={POINTS} decimals={FIXTURE_DECIMALS} nowMs={FIXTURE_NOW_MS} focalId={MARKET.marketId} onPick={noop} />
      </Fixture>
    </div>
  );
}
