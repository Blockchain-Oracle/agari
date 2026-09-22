"use client";

import { basketOf, TICKERS, type TickerSymbol } from "@agari/core/market";
import { useAssetPrice } from "@agari/markets/react";
import Link from "next/link";
import { SectionHeader } from "@/components/chrome";
import { ActivityList } from "@/features/activity/ActivityList";
import { ACTIVITY } from "@/features/activity/copy";
import { useMoneyUnits, useTickerFeed } from "@/features/activity/useActivity";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { assetPriceLine, basisRaw, feedRawToOracleRaw } from "@/features/markets/hero/units";
import { MarketSessionChip } from "@/features/markets/session";
import { NEWS } from "@/features/news/copy";
import { articleSymbols, Cashtags, MarkCluster, NewsRow } from "@/features/news/NewsRow";
import type { Article } from "@/features/news/protocol";
import { TickerRoomButton } from "@/features/room/TickerRoom";
import { BasketHub } from "./BasketHub";
import { TICKER_HUB } from "./copy";
import { PreIpoStats } from "./PreIpoStats";
import { usePreIpoFacts } from "./usePreIpoFacts";
import { pythIndexRowOf, usePythIndex, type PythIndexRow } from "./usePythIndex";
import { useNextEarnings, useTickerNews } from "./useTickerNews";
import "@/features/profile/profile.css";
import "./ticker-hub.css";

/** "Tue, Oct 21 · after close" from an ET calendar date; noon UTC keeps the weekday right in every zone. */
function reportDay(dateEt: string, hour: keyof typeof TICKER_HUB.hour | null): string {
  const day = new Date(`${dateEt}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return hour ? `${day} · ${TICKER_HUB.hour[hour]}` : day;
}

/** The ticker's headlines in the wire's row grammar (`NewsRow`, D-082): the marks and cashtags of every stock a story names. */
function Headlines({ articles }: { articles: Article[] }) {
  return (
    <ol className="news-wire tkh-headlines">
      {articles.map((article, i) => {
        const symbols = articleSymbols(article.symbols);
        return (
          <NewsRow
            key={article.url}
            index={i + 1}
            title={article.title}
            href={article.url}
            external
            mark={<MarkCluster symbols={symbols} />}
            meta={
              <>
                <span className="news-meta">
                  {NEWS.timeAgo(new Date(article.publishedAt).getTime())} · {article.source}
                </span>
                <Cashtags symbols={symbols} />
              </>
            }
            tone={article.sentiment}
            toneWord={NEWS.sentiment[article.sentiment]}
          />
        );
      })}
    </ol>
  );
}

/** The facts bar of a listed name or a pre-IPO name: the spot, then a report date or the PreStocks facts. */
function NameFacts({ symbol, preIpo, index }: { symbol: TickerSymbol; preIpo: boolean; index: PythIndexRow | null }) {
  const price = useAssetPrice(symbol);
  const earnings = useNextEarnings(preIpo ? null : symbol);
  const facts = usePreIpoFacts(preIpo ? symbol : null);
  const spot = price?.ok && price.value ? assetPriceLine(symbol, feedRawToOracleRaw(basisRaw(price.value), price.value.decimals)) : TICKER_HUB.dash;
  const report = earnings.event ? reportDay(earnings.event.dateEt, earnings.event.hour) : earnings.known ? TICKER_HUB.earningsNone : TICKER_HUB.earningsUnknown;
  return (
    <div className="prf-bar">
      {preIpo ? (
        <PreIpoStats spot={spot} spotStale={Boolean(price?.ok && price.stale)} facts={facts?.ok ? facts.value : null} index={index} />
      ) : (
        <dl className="prf-stats">
          <div className="prf-stat">
            <dt>{price?.ok && price.stale ? `${TICKER_HUB.spot} · ${TICKER_HUB.spotStale}` : TICKER_HUB.spot}</dt>
            <dd className="big numbers">{spot}</dd>
          </div>
          <div className="prf-stat">
            <dt>{TICKER_HUB.earnings}</dt>
            <dd className="big">{report}</dd>
          </div>
        </dl>
      )}
      <div className="prf-actions">
        <TickerRoomButton symbol={symbol} />
        <Link href="/markets" className="asset-tab" data-cursor="hover">
          {TICKER_HUB.trade}
        </Link>
      </div>
    </div>
  );
}

/**
 * `/tickers/[SYMBOL]` (spec §1.6): the header (spot, the session chip, the next report), the ticker's Room, the feed of
 * calls, verdicts and `$SYM` takes, the headlines filtered to the ticker, and an honest board placeholder until S5's
 * per-ticker board exists. The spot is the tab's one shared price stream; nothing here adds a chain read.
 *
 * A basket (S19, D-124) takes the same frame with its own bar and sections (`BasketHub`): the index, the members, the
 * live basket Window and what the wallet holds; a group of companies has no wire or report date of its own.
 */
export function TickerHubScreen({ symbol }: { symbol: TickerSymbol }) {
  const ticker = TICKERS[symbol];
  const basket = basketOf(symbol);
  const units = useMoneyUnits();
  const feed = useTickerFeed(symbol);
  const news = useTickerNews(basket ? null : symbol);
  const preIpo = ticker.kind === "preIpo";
  // S20: Pyth's valuation index rides beside the PreStocks facts where the venue's key may read it; absent, its rows are omitted.
  const index = pythIndexRowOf(usePythIndex(preIpo && ticker.pythIndexFeedId !== null), symbol);
  const articles = news?.ok ? news.value : null;
  const intro = basket
    ? TICKER_HUB.basket.intro(ticker.name, basket.members.map((m) => TICKERS[m.symbol].name).join(", "))
    : preIpo
      ? (index ? TICKER_HUB.preIpo.introBoth(ticker.name) : TICKER_HUB.preIpo.intro(ticker.name))
      : TICKER_HUB.intro(ticker.name);
  const feedIndex = basket ? "03" : TICKER_HUB.feed.number;

  return (
    <div className="container news-page prf-page tkh-page">
      <div className="news-inner">
        <div className="news-live tkh-live">
          <span className="news-live-label">{TICKER_HUB.eyebrow(ticker.kind)}</span>
          <MarketSessionChip />
        </div>
        <h1 className="news-title tkh-title">
          <AssetDisc asset={symbol} className="tkh-mark" />
          <span>
            {ticker.name} <span className="vermilion">${symbol}</span>
          </span>
        </h1>
        <div className="page-title-jp" lang="ja">
          {TICKER_HUB.headingJp}
        </div>
        <p className="news-intro">{intro}</p>

        {basket ? <BasketHub basket={basket} /> : <NameFacts symbol={symbol} preIpo={preIpo} index={index} />}

        <section aria-label={TICKER_HUB.feed.title}>
          <SectionHeader index={feedIndex} title={TICKER_HUB.feed.title} desc={TICKER_HUB.feed.desc} className="lb-section-head" />
          <ActivityList feed={feed.feed} failed={feed.failed} units={units} showWho empty={ACTIVITY.empty.ticker} limit={20} />
        </section>

        {!basket && (
          <section aria-label={TICKER_HUB.news.title}>
            <SectionHeader index={TICKER_HUB.news.number} title={TICKER_HUB.news.title} desc={TICKER_HUB.news.desc} eyebrow={TICKER_HUB.news.credit} className="lb-section-head" />
            {articles === null ? (
              <p className="news-quiet" role="status" aria-busy={news === null}>
                {news === null ? ACTIVITY.loading : NEWS.quiet}
              </p>
            ) : articles.length === 0 ? (
              <p className="news-quiet">{NEWS.quiet}</p>
            ) : (
              <Headlines articles={articles.slice(0, 8)} />
            )}
          </section>
        )}

        {!basket && (
          <section aria-label={TICKER_HUB.board.title}>
            <SectionHeader index={TICKER_HUB.board.number} title={TICKER_HUB.board.title} desc={TICKER_HUB.board.desc} className="lb-section-head" />
            <p className="news-quiet tkh-pending">
              {TICKER_HUB.board.pending}{" "}
              <Link href="/leaderboard" className="tkh-link" data-cursor="hover">
                {TICKER_HUB.board.link}
              </Link>
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
