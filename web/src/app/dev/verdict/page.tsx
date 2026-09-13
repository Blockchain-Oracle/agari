"use client";

import { isBytes32, toMarketId } from "@masayume/core/types";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SectionHeader } from "@/components/chrome";
import { LoadingState } from "@/components/states";
import { LiveVerdict, VerdictCard } from "@/features/markets/verdict";
import { VERDICT_UI } from "@/lib/copy";
import { Fixture, FixtureGrid } from "../states/_sections/Fixture";
import { SYMBOL } from "../states/fixtures";
import { FIXTURE_MARKET, FIXTURE_RESOLUTION, VERDICT_FIXTURES, VOID_RESOLUTION } from "./fixtures";

function LivePicker() {
  const requested = useSearchParams().get("m");
  if (!requested || !isBytes32(requested)) return null;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader index="00" title={VERDICT_UI.title} eyebrow={requested} />
      <LiveVerdict marketId={toMarketId(requested)} />
    </section>
  );
}

export default function DevVerdictPage() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-8 px-gutter py-section">
      <SectionHeader index="01" title={VERDICT_UI.devTitle} eyebrow={VERDICT_UI.devEyebrow} />
      <Suspense fallback={<LoadingState shape="plate" />}>
        <LivePicker />
      </Suspense>
      <FixtureGrid>
        <Fixture label={VERDICT_UI.fixtures.win}>
          <VerdictCard verdict={VERDICT_FIXTURES.win} market={FIXTURE_MARKET} resolution={FIXTURE_RESOLUTION} symbol={SYMBOL} />
        </Fixture>
        <Fixture label={VERDICT_UI.fixtures.loss}>
          <VerdictCard verdict={VERDICT_FIXTURES.loss} market={FIXTURE_MARKET} resolution={FIXTURE_RESOLUTION} symbol={SYMBOL} />
        </Fixture>
        <Fixture label={VERDICT_UI.fixtures.void}>
          <VerdictCard verdict={VERDICT_FIXTURES.void} market={FIXTURE_MARKET} resolution={VOID_RESOLUTION} symbol={SYMBOL} />
        </Fixture>
        <Fixture label={VERDICT_UI.fixtures.both}>
          <VerdictCard verdict={VERDICT_FIXTURES.both} market={FIXTURE_MARKET} resolution={FIXTURE_RESOLUTION} symbol={SYMBOL} />
        </Fixture>
      </FixtureGrid>
    </div>
  );
}
