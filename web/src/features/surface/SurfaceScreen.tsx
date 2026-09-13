"use client";

import { isOk, type Reading } from "@masayume/core/schemas";
import type { LaneSet } from "@masayume/core/types";
import { formatCadence } from "@masayume/core/market";
import Link from "next/link";
import { SectionHead } from "@/components/shell";
import { ErrorState, ReadingBoundary, StaleTick } from "@/components/states";
import { useChainNowMs } from "../markets/useChainNow";
import { useVenue } from "../markets/useVenue";
import { BookReadout } from "./BookReadout";
import { SURFACE } from "./copy";
import { DepthChart } from "./DepthChart";
import { SlippageLadder } from "./SlippageLadder";
import { SurfaceChips } from "./SurfaceChips";
import { TermStructure } from "./TermStructure";
import { useFocalBook } from "./useFocalBook";
import { useSurfaceSelection } from "./useSurfaceSelection";
import { useTermStructure } from "./useTermStructure";
import "./surface-page.css";

function laneReading(reading: Reading<LaneSet> | null, boot: Reading<unknown> | null): Reading<LaneSet> | null {
  if (boot && !boot.ok) return boot;
  return reading;
}

/**
 * `/surface` — `reference/yosuku/app/surface/page.tsx`, structure kept, content adapted (doc 03 §Surface):
 * the crumb, the title, the intro, the asset and Window chips, then four numbered sections. The
 * reference reads a volatility model back; this reads the venue's book back. No section shows a
 * figure the chain did not give: hydrating is "…", an empty side is "—" or its own sentence.
 */
export function SurfaceScreen() {
  const { boot, venueId } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const nowMs = useChainNowMs();
  const selection = useSurfaceSelection(venueId);
  const focal = selection.focal;
  const { book, structure, params, fee, openingRaw, spotRaw } = useFocalBook(focal);
  const points = useTermStructure(selection.windows, nowMs);
  const { sections } = SURFACE;

  return (
    <div className="container sf-page">
      <nav className="sf-crumbs" aria-label="Breadcrumb">
        <Link href="/">
          {SURFACE.crumbRoot}
        </Link>
        <span className="sf-crumbs-sep">/</span>
        <span className="sf-crumbs-here">{SURFACE.crumb}</span>
      </nav>
      <h1 className="sf-title">{SURFACE.title}</h1>
      <p className="sf-intro">
        {SURFACE.intro.lead}
        <span className="sf-intro-em">{SURFACE.intro.em}</span>
        {SURFACE.intro.rest}
      </p>

      <ReadingBoundary reading={laneReading(selection.reading, boot)} shape="plate" isEmpty={(laneSet) => laneSet.lanes.length === 0} empty={{ why: SURFACE.noLive }}>
        {(_laneSet, meta) => (
          <>
            <SurfaceChips assets={selection.assets} asset={selection.asset} onAsset={selection.setAsset} windows={selection.windows} focalId={focal?.marketId ?? null} onFocal={selection.setFocal} nowMs={nowMs} />
            {focal && (
              <div className="sf-sections">
                <section>
                  <SectionHead number={sections.book.number} title={sections.book.title} live meta={sections.meta.book(focal.asset, formatCadence(focal.intervalSec))} />
                  <BookReadout market={focal} structure={structure} hydrating={book === null} openingRaw={openingRaw} spotRaw={spotRaw} nowMs={nowMs} />
                  {book?.ok && book.stale && <StaleTick asOfMs={book.asOfMs} reason={book.staleReason} />}
                  {book && !book.ok && <ErrorState diagnosis={book.error} className="mt-3" />}
                </section>

                <section>
                  <SectionHead number={sections.depth.number} title={sections.depth.title} desc={sections.depth.desc} meta={structure ? sections.meta.levels(structure.levels) : ""} />
                  <DepthChart depth={book?.ok ? book.value : null} hydrating={book === null} />
                </section>

                <section>
                  <SectionHead number={sections.slippage.number} title={sections.slippage.title} desc={sections.slippage.desc} />
                  <SlippageLadder depth={book?.ok ? book.value : null} hydrating={book === null} symbol={symbol} lotRaw={params?.ok ? params.value.lotSizeRaw : null} feeBps={fee?.ok ? fee.value : null} />
                </section>

                <section>
                  <SectionHead number={sections.term.number} title={sections.term.title} desc={sections.term.desc(focal.asset)} meta={sections.meta.windows(selection.windows.length)} />
                  <TermStructure points={points} decimals={focal.decimals} nowMs={nowMs} focalId={focal.marketId} onPick={selection.setFocal} />
                </section>

                <p className="sf-basis">{SURFACE.basis}</p>
                {meta.stale && <StaleTick asOfMs={meta.asOfMs} reason={meta.staleReason} />}
              </div>
            )}
          </>
        )}
      </ReadingBoundary>
    </div>
  );
}
