import { Suspense } from "react";
import { NEWS } from "./copy";
import { NewsSkeleton } from "./NewsFeed";
import { NewsFromSearch } from "./NewsFromSearch";
import { NewsHead } from "./NewsHead";

/**
 * `/news` — the reference's own page, restored from its history (`app/news/page.tsx` at
 * 93d09c1^). It was cut from the reference's nav as a "broken" route while the feed component
 * and its RSS route survived; here the wire is live, so the page is too. The root layout
 * already mounts the Marquee, Header and Footer the reference's page mounted itself.
 *
 * `?symbol=TSLA` narrows the wire. The query is read on the client under Suspense, so the page stays
 * static; the prerendered fallback is the unfiltered head over the feed's own skeleton.
 */
export function NewsScreen() {
  return (
    <div className="container news-page">
      <div className="news-inner">
        <div className="news-live">
          <span className="news-live-dot" aria-hidden />
          <span className="news-live-label">{NEWS.live}</span>
        </div>
        <Suspense
          fallback={
            <>
              <NewsHead symbol={null} />
              <NewsSkeleton />
            </>
          }
        >
          <NewsFromSearch />
        </Suspense>
      </div>
    </div>
  );
}
