import { NextResponse } from "next/server";
import type { Article } from "@/features/news/protocol";

/**
 * The wire — ported from `reference/yosuku/app/api/crypto-news/route.ts`.
 *
 * Two public RSS feeds, no key, fetched server-side and cached five minutes. The sentiment
 * tag is the reference's own keyword heuristic over the headline, kept verbatim and shown
 * as a labelled tag — it is a reading of the words, not a market signal. When both feeds
 * are quiet the route says so and the page shows the empty state, never a stale story
 * dressed as new.
 */
const FEEDS: { url: string; source: string }[] = [
  { url: "https://cointelegraph.com/rss", source: "Cointelegraph" },
  { url: "https://decrypt.co/feed", source: "Decrypt" },
];

const POS = /\b(surge|surges|surged|rally|rallies|gain|gains|soar|soars|record|high|highs|bull|bullish|jump|jumps|climb|climbs|rise|rises|adoption|approve|approved|inflows?)\b/i;
const NEG = /\b(crash|crashes|plunge|plunges|drop|drops|fall|falls|hack|hacked|exploit|bear|bearish|loss|losses|sell-?off|liquidat|down|slump|outflows?|ban|lawsuit)\b/i;

const PER_FEED = 12;
const HEADLINES = 8;
const REVALIDATE_SEC = 300;

function sentiment(title: string): Article["sentiment"] {
  if (NEG.test(title)) return "negative";
  if (POS.test(title)) return "positive";
  return "neutral";
}

function strip(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseFeed(xml: string, source: string): Article[] {
  const items = xml.split("<item>").slice(1);
  const out: Article[] = [];
  for (const block of items.slice(0, PER_FEED)) {
    const title = strip(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const link = strip(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    if (!title || !link) continue;
    out.push({
      title,
      source,
      url: link,
      publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
      sentiment: sentiment(title),
    });
  }
  return out;
}

export async function GET() {
  try {
    const results = await Promise.all(
      FEEDS.map(async ({ url, source }) => {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "MasayumeNewsBot/1.0" },
            next: { revalidate: REVALIDATE_SEC },
          });
          if (!res.ok) return [];
          return parseFeed(await res.text(), source);
        } catch {
          return [];
        }
      }),
    );

    // newest first, dedupe by title
    const seen = new Set<string>();
    const articles = results
      .flat()
      .filter((article) => (seen.has(article.title) ? false : (seen.add(article.title), true)))
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
      .slice(0, HEADLINES);

    if (articles.length === 0) {
      return NextResponse.json({ articles: [], error: "no live headlines" });
    }
    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ articles: [], error: "news unavailable" });
  }
}
