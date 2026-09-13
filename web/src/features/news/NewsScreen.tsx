import { NEWS } from "./copy";
import { NewsFeed } from "./NewsFeed";

/**
 * `/news` — the reference's own page, restored from its history (`app/news/page.tsx` at
 * 93d09c1^). It was cut from the reference's nav as a "broken" route while the feed component
 * and its RSS route survived; here the wire is live, so the page is too. The root layout
 * already mounts the Marquee, Header and Footer the reference's page mounted itself.
 */
export function NewsScreen() {
  return (
    <div className="container news-page">
      <div className="news-inner">
        <div className="news-live">
          <span className="news-live-dot" aria-hidden />
          <span className="news-live-label">{NEWS.live}</span>
        </div>
        <h1 className="news-title">
          {NEWS.heading} <span className="vermilion">{NEWS.headingAccent}</span>
        </h1>
        <div className="page-title-jp" lang="ja">
          {NEWS.headingJp}
        </div>
        <p className="news-intro">{NEWS.intro}</p>
        <NewsFeed />
      </div>
    </div>
  );
}
