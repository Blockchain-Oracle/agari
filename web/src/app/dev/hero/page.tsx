"use client";

import type { LaneSet, MarketId } from "@masayume/core/types";
import { isBytes32, toMarketId } from "@masayume/core/types";
import { marketsProvider } from "@masayume/markets";
import { useLanes, useMarketsBoot } from "@masayume/markets/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SectionHeader } from "@/components/chrome";
import { LoadingState, ReadingBoundary } from "@/components/states";
import { HeroMarket } from "@/features/markets/hero";
import { HERO, SECTIONS } from "@/lib/copy";
import { webEnv } from "@/lib/env";

/** The soonest-expiring window still open right now. */
function soonestLive(lanes: LaneSet, nowMs: number): MarketId | null {
  const nowSec = Math.floor(nowMs / 1000);
  const live = lanes.lanes.flatMap((lane) => lane.markets).filter((m) => m.expirySec > nowSec);
  return live.sort((a, b) => a.expirySec - b.expirySec)[0]?.marketId ?? null;
}

function HeroPicker() {
  const requested = useSearchParams().get("m");
  const boot = useMarketsBoot(webEnv.markets);
  const venueId = boot?.ok ? boot.value.venue.venueId : null;
  const lanes = useLanes(venueId);
  const forced = requested && isBytes32(requested) ? toMarketId(requested) : null;

  if (forced) return <HeroMarket marketId={forced} />;
  return (
    <ReadingBoundary reading={boot?.ok ? lanes : boot} shape="chart" isEmpty={(v) => "lanes" in v && soonestLive(v, marketsProvider.nowMs()) === null} empty={HERO.devEmpty}>
      {(value) => {
        const marketId = "lanes" in value ? soonestLive(value, marketsProvider.nowMs()) : null;
        return marketId ? <HeroMarket marketId={marketId} /> : <LoadingState shape="chart" />;
      }}
    </ReadingBoundary>
  );
}

export default function DevHeroPage() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-6 px-gutter py-section">
      <SectionHeader index={SECTIONS.hero.index} title={HERO.devTitle} eyebrow="?m=<marketId> to pin one" />
      <Suspense fallback={<LoadingState shape="chart" />}>
        <HeroPicker />
      </Suspense>
    </div>
  );
}
