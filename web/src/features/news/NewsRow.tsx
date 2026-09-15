import { isTickerSymbol, type TickerSymbol } from "@agari/core/market";
import Link from "next/link";
import type { ReactNode } from "react";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { tickerHref } from "@/features/takes/cashtags";
import type { Sentiment } from "./protocol";

/** The most marks and cashtags one row carries; a wire story rarely names more than two registry tickers. */
export const ROW_SYMBOLS_MAX = 4;

/** The registry tickers a wire story is filed under, in the wire's order, without repeats. */
export function articleSymbols(symbols: readonly string[] | undefined): TickerSymbol[] {
  return [...new Set((symbols ?? []).filter(isTickerSymbol))].slice(0, ROW_SYMBOLS_MAX);
}

/** The asset marks in a cluster (D-082, D-085): the 18c disc at the row's size, overlapping like a byline of faces. */
export function MarkCluster({ symbols, className }: { symbols: readonly string[]; className?: string }) {
  if (symbols.length === 0) return null;
  return (
    <span className={className ? `news-marks ${className}` : "news-marks"} aria-hidden>
      {symbols.map((symbol) => (
        <AssetDisc key={symbol} asset={symbol} className="news-mark" />
      ))}
    </span>
  );
}

/** `$TSLA $NVDA` — each a mono link to its ticker hub, after the source in the meta line. */
export function Cashtags({ symbols }: { symbols: readonly TickerSymbol[] }) {
  if (symbols.length === 0) return null;
  return (
    <span className="news-cashtags">
      {symbols.map((symbol) => (
        <Link key={symbol} href={tickerHref(symbol)} className="news-cashtag" data-cursor="hover">
          ${symbol}
        </Link>
      ))}
    </span>
  );
}

/** The sentiment (or an activity kind) as a dot and a word — a labelled tone, never a number. */
export function Tone({ tone, word }: { tone: Sentiment; word: string }) {
  return (
    <span className="news-tone" data-tone={tone}>
      <span className="news-tone-dot" aria-hidden />
      {word}
    </span>
  );
}

export interface NewsRowProps {
  /** 1-based; the wire's lead is 01, so its rows start at 02. */
  index: number;
  title: string;
  /** Where the title goes: an article, a transaction, a Window; null for a row that is only a record. */
  href: string | null;
  external?: boolean;
  /** What sits in the mark slot: an asset cluster, a wallet avatar. Nothing still keeps the column. */
  mark?: ReactNode;
  /** The mono line under the title: time · source · cashtags, or time · wallet. */
  meta: ReactNode;
  tone: Sentiment;
  toneWord: string;
  /** `data-kind` for a feed that styles by event kind. */
  kind?: string;
}

/**
 * One wire row in the grammar every feed shares (D-082, V1 "Ledger"): `index · mark slot · body · tone · arrow`,
 * a 2 px edge in the tone's ink down the left. The row is a list item and the title is its only link — a row that is
 * itself an anchor cannot carry cashtag links, and the parser splits it at the first one. `/news`, the activity feed
 * and the ticker hub's headlines all render this; the column layout lives in `styles/news.css`.
 */
export function NewsRow({ index, title, href, external = false, mark, meta, tone, toneWord, kind }: NewsRowProps) {
  return (
    <li className="news-row" data-tone={tone} data-kind={kind}>
      <span className="news-index">{String(index).padStart(2, "0")}</span>
      <span className="news-row-mark">{mark}</span>
      <span className="news-row-body">
        {href === null ? (
          <span className="news-row-title">{title}</span>
        ) : external ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="news-row-title" data-cursor="hover">
            {title}
          </a>
        ) : (
          <Link href={href} className="news-row-title" data-cursor="hover">
            {title}
          </Link>
        )}
        <span className="news-row-meta">{meta}</span>
      </span>
      <span className="news-row-tone">
        <Tone tone={tone} word={toneWord} />
      </span>
      <span className="news-row-arrow" aria-hidden>
        {external ? "↗" : "→"}
      </span>
    </li>
  );
}
