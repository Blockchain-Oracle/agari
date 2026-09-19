import { isTickerSymbol, TICKER_SYMBOLS, TICKERS, tickerSymbolSchema, type TickerSymbol } from "@agari/core/market";

/** A pre-IPO name has no exchange listing, so no company wire and no earnings date exist for it (D-100). */
const LISTED = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].kind !== "preIpo");
import { NextResponse, type NextRequest } from "next/server";
import type { Article } from "@/features/news/protocol";
import { companyNews, finnhubConfigured, marketNews, type FinnhubArticle } from "@/lib/finnhub.server";

/**
 * The wire — ported from `reference/yosuku/app/api/crypto-news/route.ts`, on Finnhub (social-assistant.md §1.4).
 *
 * Finnhub's market wire (`news?category=general`) merged with company news for every registry ticker over 48 h,
 * deduped by title and cut to the newest eight; `?symbol=TSLA` reads that ticker's company news alone. `source` is
 * Finnhub's publisher. The sentiment tag is the reference's own keyword heuristic over the headline, kept verbatim
 * and shown as a labelled tag — it is a reading of the words, not a market signal. When nothing can be read the
 * route says so and the page shows the empty state, never a stale story dressed as new.
 */
export const runtime = "nodejs";

const POS = /\b(surge|surges|surged|rally|rallies|gain|gains|soar|soars|record|high|highs|bull|bullish|jump|jumps|climb|climbs|rise|rises|adoption|approve|approved|inflows?)\b/i;
const NEG = /\b(crash|crashes|plunge|plunges|drop|drops|fall|falls|hack|hacked|exploit|bear|bearish|loss|losses|sell-?off|liquidat|down|slump|outflows?|ban|lawsuit)\b/i;

const HEADLINES = 8;
/** The reference's 300 s revalidate, now on the response; each Finnhub feed is also cached underneath (`finnhub.server.ts`). */
const REVALIDATE_SEC = 300;
const CACHED = `public, s-maxage=${REVALIDATE_SEC}, stale-while-revalidate=${REVALIDATE_SEC}`;
const UNCACHED = "no-store";

function sentiment(title: string): Article["sentiment"] {
  if (NEG.test(title)) return "negative";
  if (POS.test(title)) return "positive";
  return "neutral";
}

/** Newest first, one row per title; a story several tickers carry keeps every ticker it was filed under. */
function merge(feeds: readonly (FinnhubArticle[] | null)[]): Article[] {
  const byTitle = new Map<string, FinnhubArticle>();
  for (const article of feeds.flatMap((feed) => feed ?? [])) {
    const seen = byTitle.get(article.title);
    if (!seen) byTitle.set(article.title, { ...article, symbols: [...article.symbols] });
    else for (const symbol of article.symbols) if (!seen.symbols.includes(symbol)) seen.symbols.push(symbol);
  }
  return [...byTitle.values()]
    .sort((a, b) => b.publishedAtSec - a.publishedAtSec)
    .slice(0, HEADLINES)
    .map((article) => ({
      title: article.title,
      source: article.source,
      url: article.url,
      publishedAt: new Date(article.publishedAtSec * 1000).toISOString(),
      sentiment: sentiment(article.title),
      symbols: article.symbols.filter(isTickerSymbol),
    }));
}

export async function GET(request: NextRequest) {
  const rawSymbol = request.nextUrl.searchParams.get("symbol");
  const parsed = rawSymbol === null ? null : tickerSymbolSchema.safeParse(rawSymbol.toUpperCase());
  if (parsed && !parsed.success) {
    return NextResponse.json({ articles: [], error: "unknown symbol" }, { status: 400, headers: { "cache-control": UNCACHED } });
  }
  if (!finnhubConfigured()) {
    return NextResponse.json({ articles: [], error: "news provider not configured" }, { headers: { "cache-control": UNCACHED } });
  }

  try {
    const symbol: TickerSymbol | null = parsed ? parsed.data : null;
    const feeds = symbol ? [await companyNews(symbol)] : await Promise.all([marketNews(), ...LISTED.map(companyNews)]);
    const articles = merge(feeds);
    if (articles.length === 0) {
      return NextResponse.json({ articles: [], error: "no live headlines" }, { headers: { "cache-control": UNCACHED } });
    }
    // A feed the call budget skipped is read again on the next poll, so a partial wire is not shared from a cache.
    const complete = feeds.every((feed) => feed !== null);
    return NextResponse.json({ articles }, { headers: { "cache-control": complete ? CACHED : UNCACHED } });
  } catch {
    return NextResponse.json({ articles: [], error: "news unavailable" }, { headers: { "cache-control": UNCACHED } });
  }
}
