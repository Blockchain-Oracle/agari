"use client";

import { BASKET_SYMBOLS, BASKETS, basketMembersHeld, isBasketCoverable, type BasketSymbol } from "@agari/core/market";
import type { LaneSet } from "@agari/core/types";
import { useAssetPrice } from "@agari/markets/react";
import { SectionHeader } from "@/components/chrome";
import { useHoldings } from "@/features/hedge/useHoldings";
import { basisRaw, feedRawToOracleRaw } from "@/features/markets/hero/units";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { useLanesState } from "@/features/markets/lanes";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { usePreIpoFactsAll, type PreIpoFactsView } from "@/features/ticker-hub/usePreIpoFacts";
import { useWalletSession } from "@/lib/wallet-session";
import { StatusDot } from "@/components/ui/desk-kit";
import { basketLine, lineNumbers, useDeskMarks, type DeskMarks } from "@/features/desk/useDeskMarks";
import { BasketCard } from "./BasketCard";
import { heldSymbols, tradingBasketWindow } from "./basket-window";
import { BASKETS_COPY } from "./copy";
import "@/features/profile/profile.css";
import "./baskets.css";

interface LiveCardProps {
  symbol: BasketSymbol;
  laneSet: LaneSet | null;
  nowMs: number;
  facts: PreIpoFactsView | null;
  held: ReadonlySet<string> | null;
  marks: DeskMarks | null;
}

/** One basket's live card: its index from the price stream (the feed's index in points), its Window's book, its facts. */
function LiveBasketCard({ symbol, laneSet, nowMs, facts, held, marks }: LiveCardProps) {
  const basket = BASKETS[symbol];
  const price = useAssetPrice(symbol);
  const window = tradingBasketWindow(laneSet, symbol, nowMs);
  const { upCents, downCents, hydrating } = useTopOfBook(window);
  const live = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  const indexRaw = live ?? facts?.indexE8 ?? null;
  return (
    <BasketCard
      basket={basket}
      indexRaw={indexRaw}
      move={facts?.move ?? null}
      window={window}
      book={window && !hydrating ? { upCents, downCents } : null}
      nowMs={nowMs}
      heldCount={held ? basketMembersHeld(basket, held).length : null}
      coverable={held ? isBasketCoverable(basket, held) : false}
      line={lineNumbers(basketLine(marks, symbol))}
    />
  );
}

/** `/baskets` (S19 §5.2): the five baskets as cards, in registry order. Every read is one the app already makes. */
export function BasketsIndex() {
  const venue = useVenue();
  const lanes = useLanesState(venue.venueId);
  const nowMs = useChainNowMs();
  const { address } = useWalletSession();
  const holdings = useHoldings(address);
  const facts = usePreIpoFactsAll(true);
  const held = holdings?.ok ? heldSymbols(holdings.value) : null;
  const marks = useDeskMarks();
  return (
    <div className="container news-page prf-page bk-page">
      <div className="news-inner">
        <div className="news-live tkh-live">
          <span className="news-live-label">{BASKETS_COPY.eyebrow}</span>
          <StatusDot tone="live" className="bk-live-chip">{BASKETS_COPY.alwaysOpen}</StatusDot>
        </div>
        <h1 className="news-title">{BASKETS_COPY.title}</h1>
        <div className="page-title-jp" lang="ja">
          {BASKETS_COPY.headingJp}
        </div>
        <p className="news-intro">{BASKETS_COPY.intro}</p>
        <section aria-label={BASKETS_COPY.title}>
          <SectionHeader index="01" title={BASKETS_COPY.title} className="lb-section-head" />
          <div className="bk-grid">
            {BASKET_SYMBOLS.map((symbol) => (
              <LiveBasketCard key={symbol} symbol={symbol} laneSet={lanes.laneSet} nowMs={nowMs} facts={facts?.ok ? (facts.value[symbol] ?? null) : null} held={held} marks={marks} />
            ))}
          </div>
        </section>
        <p className="hg-banner-foot bk-foot">{BASKETS_COPY.foot}</p>
      </div>
    </div>
  );
}
