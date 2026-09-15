"use client";

import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { useAssetPrice } from "@agari/markets/react";
import Link from "next/link";
import { SectionHeader } from "@/components/chrome";
import { ActivityList } from "@/features/activity/ActivityList";
import { ACTIVITY } from "@/features/activity/copy";
import { useMoneyUnits, useTickerFeed } from "@/features/activity/useActivity";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { basisRaw, feedRawToOracleRaw, usdLine } from "@/features/markets/hero/units";
import { MarketSessionChip } from "@/features/markets/session";
import { NEWS } from "@/features/news/copy";
import type { Article } from "@/features/news/protocol";
import { TickerRoomButton } from "@/features/room/TickerRoom";
import { TICKER_HUB } from "./copy";
import { useNextEarnings, useTickerNews } from "./useTickerNews";
import "@/features/profile/profile.css";
import "./ticker-hub.css";

/** "Tue, Oct 21 · after close" from an ET calendar date; noon UTC keeps the weekday right in every zone. */
function reportDay(dateEt: string, hour: keyof typeof TICKER_HUB.hour | null): string {
  const day = new Date(`${dateEt}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return hour ? `${day} · ${TICKER_HUB.hour[hour]}` : day;
}

function Headlines({ articles }: { articles: Article[] }) {
  return (
    <ol className="act-list">
      {articles.map((article, i) => (
        <li key={article.url} className="news-row">
          <span className="news-index">{String(i + 1).padStart(2, "0")}</span>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-row-body" data-cursor="hover">
            <span className="news-row-title">{article.title}</span>
            <span className="news-row-meta">
              <span className="news-tag" data-tone={article.sentiment}>
                {NEWS.sentiment[article.sentiment]}
              </span>
              <span className="news-meta">
                {NEWS.timeAgo(new Date(article.publishedAt).getTime())} · {article.source}
              </span>
            </span>
          </a>
          <span className="news-row-arrow" aria-hidden>
            ↗
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * `/tickers/[SYMBOL]` (spec §1.6): the header (spot, the session chip, the next report), the ticker's Room, the feed of
 * calls, verdicts and `$SYM` takes, the headlines filtered to the ticker, and an honest board placeholder until S5's
 * per-ticker board exists. The spot is the tab's one shared price stream; nothing here adds a chain read.
 */
export function TickerHubScreen({ symbol }: { symbol: TickerSymbol }) {
  const ticker = TICKERS[symbol];
  const units = useMoneyUnits();
  const price = useAssetPrice(symbol);
  const feed = useTickerFeed(symbol);
  const news = useTickerNews(symbol);
  const earnings = useNextEarnings(symbol);

  const spot = price?.ok && price.value ? usdLine(feedRawToOracleRaw(basisRaw(price.value), price.value.decimals)) : TICKER_HUB.dash;
  const report = earnings.event ? reportDay(earnings.event.dateEt, earnings.event.hour) : earnings.known ? TICKER_HUB.earningsNone : TICKER_HUB.earningsUnknown;
  const articles = news?.ok ? news.value : null;

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
        <p className="news-intro">{TICKER_HUB.intro(ticker.name)}</p>

        <div className="prf-bar">
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
          <div className="prf-actions">
            <TickerRoomButton symbol={symbol} />
            <Link href="/markets" className="asset-tab" data-cursor="hover">
              {TICKER_HUB.trade}
            </Link>
          </div>
        </div>

        <section aria-label={TICKER_HUB.feed.title}>
          <SectionHeader index={TICKER_HUB.feed.number} title={TICKER_HUB.feed.title} desc={TICKER_HUB.feed.desc} className="lb-section-head" />
          <ActivityList feed={feed.feed} failed={feed.failed} units={units} showWho empty={ACTIVITY.empty.ticker} limit={20} />
        </section>

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

        <section aria-label={TICKER_HUB.board.title}>
          <SectionHeader index={TICKER_HUB.board.number} title={TICKER_HUB.board.title} desc={TICKER_HUB.board.desc} className="lb-section-head" />
          <p className="news-quiet tkh-pending">
            {TICKER_HUB.board.pending}{" "}
            <Link href="/leaderboard" className="tkh-link" data-cursor="hover">
              {TICKER_HUB.board.link}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
