"use client";

import { NEWS } from "./copy";
import type { Article, Sentiment } from "./protocol";
import { useNews } from "./useNews";

function Tag({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span className="news-tag" data-tone={sentiment}>
      {NEWS.sentiment[sentiment]}
    </span>
  );
}

function Meta({ article }: { article: Article }) {
  return (
    <span className="news-meta">
      {NEWS.timeAgo(new Date(article.publishedAt).getTime())} · {article.source}
    </span>
  );
}

/** Reference L69–84: a display-size lead and five wire lines, pulsing. */
function Skeleton() {
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
 * The wire — ported from `reference/yosuku/components/NewsFeed.tsx`.
 *
 * "Editorial front page, not a widget: one lead story at display size, then numbered ruled
 * rows. Sentiment is a labeled tag; metadata is mono; whitespace and hairlines do the layout."
 * The tag is the route's keyword heuristic over the headline, and says so by being a word,
 * never a number.
 */
export function NewsFeed() {
  const reading = useNews();

  if (reading === null) return <Skeleton />;
  const articles = reading.ok ? reading.value : [];
  if (articles.length === 0) return <p className="news-quiet">{NEWS.quiet}</p>;

  const [lead, ...rest] = articles as [Article, ...Article[]];

  return (
    <div className="news-feed">
      {/* Lead story */}
      <a href={lead.url} target="_blank" rel="noopener noreferrer" data-cursor="hover" className="news-lead">
        <div className="news-lead-meta">
          <span className="news-index accent">01</span>
          <Tag sentiment={lead.sentiment} />
          <Meta article={lead} />
        </div>
        <h2 className="news-lead-title">
          {lead.title}
          <span className="news-lead-arrow" aria-hidden>
            ↗
          </span>
        </h2>
      </a>

      {/* Rule — square endpoint, hairline */}
      <div className="news-rule" aria-hidden>
        <div className="news-rule-end" />
        <div className="news-rule-line" />
      </div>

      {/* The wire */}
      {rest.map((article, i) => (
        <a key={article.url} href={article.url} target="_blank" rel="noopener noreferrer" data-cursor="hover" className="news-row">
          <span className="news-index">{String(i + 2).padStart(2, "0")}</span>
          <span className="news-row-body">
            <span className="news-row-title">{article.title}</span>
            <span className="news-row-meta">
              <Tag sentiment={article.sentiment} />
              <Meta article={article} />
            </span>
          </span>
          <span className="news-row-arrow" aria-hidden>
            ↗
          </span>
        </a>
      ))}
    </div>
  );
}
