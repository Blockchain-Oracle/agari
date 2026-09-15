"use client";

import type { TickerSymbol } from "@agari/core/market";
import { NEWS } from "./copy";
import { articleSymbols, Cashtags, MarkCluster, NewsRow, Tone } from "./NewsRow";
import type { Article } from "./protocol";
import { useNews } from "./useNews";

function Meta({ article }: { article: Article }) {
  return (
    <span className="news-meta">
      {NEWS.timeAgo(new Date(article.publishedAt).getTime())} · {article.source}
    </span>
  );
}

/** Reference L69–84: a display-size lead and five wire lines, pulsing. */
export function NewsSkeleton() {
  const widths = ["85%", "76%", "67%", "58%", "49%"];
  return (
    <div className="news-feed news-skeleton" role="status" aria-busy="true">
      <div className="news-skeleton-lead">
        <div className="news-bone eyebrow" />
        <div className="news-bone headline" />
        <div className="news-bone headline short" />
      </div>
      <div className="news-skeleton-wire">
        {widths.map((width) => (
          <div key={width} className="news-bone line" style={{ width }} />
        ))}
      </div>
    </div>
  );
}

/**
 * The wire — ported from `reference/yosuku/components/NewsFeed.tsx`, redesigned under D-082 (V1 "Ledger").
 *
 * "Editorial front page, not a widget: one lead story at display size, then numbered ruled
 * rows. Sentiment is a labeled tag; metadata is mono; whitespace and hairlines do the layout."
 * The tone is the route's keyword heuristic over the headline, and says so by being a word,
 * never a number. What D-082 adds: a 2 px edge in the tone's ink on the lead and every row, the
 * stocks a story names as their marks and `$TICKER` cashtags (from `Article.symbols`, shown at
 * last), and one row grammar the activity feed and the ticker hub share (`NewsRow`).
 * `symbol` narrows the wire to one ticker's company news (`/news?symbol=`, the ticker hub).
 */
export function NewsFeed({ symbol = null }: { symbol?: TickerSymbol | null }) {
  const reading = useNews(symbol);

  if (reading === null) return <NewsSkeleton />;
  const articles = reading.ok ? reading.value : [];
  if (articles.length === 0) return <p className="news-quiet">{NEWS.quiet}</p>;

  const [lead, ...rest] = articles as [Article, ...Article[]];
  const leadSymbols = articleSymbols(lead.symbols);

  return (
    <div className="news-feed">
      {/* Lead story: the edge carries its tone; the stocks it names sit under the headline */}
      <div className="news-lead" data-tone={lead.sentiment}>
        <div className="news-lead-meta">
          <span className="news-index accent">01</span>
          <Tone tone={lead.sentiment} word={NEWS.sentiment[lead.sentiment]} />
          <Meta article={lead} />
        </div>
        <a href={lead.url} target="_blank" rel="noopener noreferrer" data-cursor="hover" className="news-lead-link">
          <h2 className="news-lead-title">
            {lead.title}
            <span className="news-lead-arrow" aria-hidden>
              ↗
            </span>
          </h2>
        </a>
        {leadSymbols.length > 0 && (
          <div className="news-lead-foot">
            <MarkCluster symbols={leadSymbols} className="news-lead-marks" />
            <Cashtags symbols={leadSymbols} />
          </div>
        )}
      </div>

      {/* Rule — square endpoint, hairline */}
      <div className="news-rule" aria-hidden>
        <div className="news-rule-end" />
        <div className="news-rule-line" />
      </div>

      {/* The wire */}
      <ol className="news-wire">
        {rest.map((article, i) => {
          const symbols = articleSymbols(article.symbols);
          return (
            <NewsRow
              key={article.url}
              index={i + 2}
              title={article.title}
              href={article.url}
              external
              mark={<MarkCluster symbols={symbols} />}
              meta={
                <>
                  <Meta article={article} />
                  <Cashtags symbols={symbols} />
                </>
              }
              tone={article.sentiment}
              toneWord={NEWS.sentiment[article.sentiment]}
            />
          );
        })}
      </ol>
    </div>
  );
}
