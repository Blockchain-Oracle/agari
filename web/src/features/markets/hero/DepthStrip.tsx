"use client";

import type { BookLevelView, EventMarket } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { useBook } from "@masayume/markets/react";
import { Odds } from "@/components/data";
import { ReadingBoundary, StaleTick } from "@/components/states";
import { HERO } from "@/lib/copy";

const DEPTH = 3;

interface DepthStripProps {
  market: EventMarket;
}

function DepthColumn({ title, asks, decimals }: { title: string; asks: BookLevelView[]; decimals: number }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="type-label-micro text-ink-muted">{title}</span>
      {asks.length === 0 ? (
        <span className="type-caption text-ink-secondary">{HERO.noDepth}</span>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {asks.map((level) => (
            <li key={level.priceRaw.toString()} className="flex justify-between gap-3 type-data">
              <Odds bps={level.priceBps} className="text-ink" />
              <span className="numbers text-ink-secondary">
                {formatBaseUnits(level.quantityRaw, decimals, { minDp: 0 })} {HERO.contracts}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Top of book for both sides — what you pay to buy each. An empty side says so; nothing is invented. */
export function DepthStrip({ market }: DepthStripProps) {
  // The reading carries the coordinator's canonical depth; DEPTH is how many of those levels we show.
  const book = useBook({ marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals });
  return (
    <section aria-label={HERO.depthTitle} className="flex flex-col gap-2 border-t border-hairline pt-3">
      <ReadingBoundary reading={book} shape="row" tick={false}>
        {(depth, meta) => (
          <>
            <div className="flex gap-6">
              <DepthColumn title={HERO.buyUp} asks={depth.upAsks.slice(0, DEPTH)} decimals={depth.decimals} />
              <DepthColumn title={HERO.buyDown} asks={depth.downAsks.slice(0, DEPTH)} decimals={depth.decimals} />
            </div>
            {meta.stale && <StaleTick asOfMs={meta.asOfMs} reason={meta.staleReason} compact />}
          </>
        )}
      </ReadingBoundary>
    </section>
  );
}
