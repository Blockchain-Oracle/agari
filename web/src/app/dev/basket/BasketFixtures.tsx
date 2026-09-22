"use client";

import type { MarketId, Side } from "@agari/core/types";
import { marketDeepLink } from "@agari/core/urls";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/chrome";
import { BASKETS_COPY, BasketCard } from "@/features/baskets";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { HeroQuestion } from "@/features/markets/hero/HeroQuestion";
import { PriceSourceNote } from "@/features/markets/hero/PriceSourceNote";
import { MarketCardView, PausedCard } from "@/features/markets/lanes";
import { BasketHubView } from "@/features/ticker-hub/BasketHub";
import { CLOCK } from "../session/market-session-fixtures";
import { Fixture } from "../states/_sections/Fixture";
import { AILABS, AILABS_CARD, AILABS_FACTS, AILABS_NOW, AILABS_OPEN, AILABS_WINDOW, ANTHROPIC_PRE, HELD_BOTH, HELD_NONE, OPENAI_PRE, OPENAI_WINDOW } from "./fixtures";
import "@/features/profile/profile.css";
import "@/features/ticker-hub/ticker-hub.css";
import "@/styles/news-wire.css";

const NOW_MS = CLOCK.weekendSat * 1000;
const noop = () => {};
const heldBoth = new Set(HELD_BOTH.map((h) => h.underlying));
const heldNone = new Set(HELD_NONE.map((h) => h.underlying));
const heldValue = HELD_BOTH.reduce((sum, h) => sum + (h.exposureUsdE6 ?? 0n), 0n);

/** The basket Window's card from canned data, as the hub and the lanes would draw it. */
function CannedCard({ onSelect }: { onSelect: (marketId: MarketId, side?: Side) => void }) {
  return <MarketCardView market={AILABS_WINDOW} nowMs={NOW_MS} selected={false} onSelect={onSelect} onOpenRoom={noop} {...AILABS_CARD} />;
}

/** Every basket surface from fixtures (S19 A5): the mark, the card, the hero question, the source notes, the hub, the index card. */
export function BasketFixtures() {
  const router = useRouter();
  const open = (marketId: MarketId, side?: Side) => router.push(marketDeepLink({ marketId, dir: side }));
  const D = BASKETS_COPY.dev;
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-6 px-gutter py-8">
      <SectionHeader index="S19" title={D.title} />
      <p className="type-body text-ink-secondary">{D.intro}</p>
      <div className="flex flex-col gap-6">
        <Fixture label={D.marks}>
          <div className="flex items-center gap-6">
            <AssetDisc asset="AILABS" className="news-mark" />
            <AssetDisc asset="FRONTIER" className="tkh-mark" />
            <AssetDisc asset="PREALL" className="hg-banner-mark" />
            <AssetDisc asset="PREDMKTS" className="tkh-mark" />
            <AssetDisc asset="DEFSPACE" className="hg-banner-mark" />
          </div>
        </Fixture>
        <Fixture label={D.trading}>
          <div className="markets-main">
            <CannedCard onSelect={open} />
          </div>
        </Fixture>
        <Fixture label={D.paused}>
          <div className="markets-main">
            <PausedCard asset="AILABS" basis="token" intervalSec={3_600} state="paused: no signed source" />
          </div>
        </Fixture>
        <Fixture label={D.hero}>
          <div className="hero-chart-head">
            <div>
              <HeroQuestion asset="AILABS" openingRaw={AILABS_OPEN} currentRaw={AILABS_NOW} />
            </div>
          </div>
          <HeroQuestion asset="AILABS" openingRaw={null} currentRaw={null} />
        </Fixture>
        <Fixture label={D.source}>
          <PriceSourceNote market={AILABS_WINDOW} />
          <PriceSourceNote market={OPENAI_WINDOW} />
        </Fixture>
        <Fixture label={D.hubNone}>
          <div className="news-page prf-page tkh-page">
            <div className="news-inner">
              <BasketHubView basket={AILABS} indexRaw={AILABS_NOW} indexStale={false} facts={AILABS_FACTS} window={AILABS_WINDOW} windowCard={<CannedCard onSelect={open} />} held={heldNone} heldValueUsdE6={null} />
            </div>
          </div>
        </Fixture>
        <Fixture label={D.hubTwo}>
          <div className="news-page prf-page tkh-page">
            <div className="news-inner">
              <BasketHubView basket={AILABS} indexRaw={AILABS_NOW} indexStale={false} facts={AILABS_FACTS} window={AILABS_WINDOW} windowCard={<CannedCard onSelect={open} />} held={heldBoth} heldValueUsdE6={heldValue} />
            </div>
          </div>
          <p className="type-caption text-ink-muted">
            {OPENAI_PRE.symbol} + {ANTHROPIC_PRE.symbol} held → cover offered
          </p>
        </Fixture>
        <Fixture label={D.indexCard}>
          <div className="bk-grid">
            <BasketCard basket={AILABS} indexRaw={AILABS_NOW} move={AILABS_FACTS.move ?? null} window={AILABS_WINDOW} book={{ upCents: 54, downCents: 48 }} nowMs={NOW_MS} heldCount={2} coverable />
          </div>
        </Fixture>
        <Fixture label={D.indexCardNone}>
          <div className="bk-grid">
            <BasketCard basket={AILABS} indexRaw={null} move={null} window={null} book={null} nowMs={NOW_MS} heldCount={null} coverable={false} />
          </div>
        </Fixture>
      </div>
    </div>
  );
}
