import type { TickerSymbol } from "@agari/core/market";
import { NEWS } from "./copy";

/** The page head (reference `app/news/page.tsx`); `symbol` names the ticker the wire is narrowed to. */
export function NewsHead({ symbol }: { symbol: TickerSymbol | null }) {
  return (
    <>
      <h1 className="news-title">
        {symbol ?? NEWS.heading} <span className="vermilion">{NEWS.headingAccent}</span>
      </h1>
      <div className="page-title-jp" lang="ja">
        {NEWS.headingJp}
      </div>
      <p className="news-intro">{NEWS.intro}</p>
    </>
  );
}
