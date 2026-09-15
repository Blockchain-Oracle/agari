import { addDays, etDateOf, isTickerSymbol, SEC_PER_DAY, SEC_PER_HOUR, type TickerSymbol } from "@agari/core/market";
import { z } from "zod";

/**
 * Finnhub, server-only (social-assistant.md §3.1): market news, company news and the earnings calendar.
 *
 * - **Key:** `FINNHUB_API_KEY`, sent as the `X-Finnhub-Token` header so it never sits in a URL. Nothing here logs
 *   or returns it; every failure collapses to `null`.
 * - **Budget:** the free key's 60 calls/min is shared with ops, so the web keeps to 10 calls in any 60 s,
 *   counted once per process. Over budget, a read serves what it last fetched, or `null`; it never waits.
 * - **Cache:** in memory per instance, with in-flight reads shared, so a burst of routes costs one call each.
 * - **Earnings:** one `/calendar/earnings?symbol=` call per ticker per 6 h. The unfiltered calendar is capped at
 *   1,500 rows and keeps the latest dates, so in reporting season it silently drops early reports (probed
 *   2026-09-15: Oct 20–Nov 3 came back as Oct 27–Nov 3, without TSLA's Oct 20).
 */

export interface EarningsEvent { symbol: TickerSymbol; dateEt: string; hour: "bmo" | "amc" | "dmh" | null }
export interface FinnhubArticle { title: string; source: string; url: string; publishedAtSec: number; symbols: string[] }

const BASE_URL = "https://finnhub.io/api/v1";
const CALLS_PER_WINDOW = 10;
const WINDOW_MS = 60_000;
const TIMEOUT_MS = 8_000;

const MARKET_NEWS_TTL_MS = 300_000;
const COMPANY_NEWS_TTL_MS = 900_000;
const EARNINGS_TTL_MS = 6 * SEC_PER_HOUR * 1000;
/** How long a last good read may stand in for a failed or over-budget refresh. */
const STALE_LIMIT_MS = { market: 3_600_000, company: 7_200_000, earnings: 24 * SEC_PER_HOUR * 1000 } as const;

const COMPANY_LOOKBACK_SEC = 2 * SEC_PER_DAY;
/** Each ticker's calendar read covers this far ahead, so any `days` up to it is answered from the one cached call. */
const EARNINGS_LOOKAHEAD_DAYS = 60;
/** Rows kept per feed: the wire shows 8, so a few dozen per source is ample and bounds memory. */
const KEEP_ARTICLES = 30;

interface Entry<T> { value: T; fetchedAtMs: number }
interface ClientState {
  callsAtMs: number[];
  cache: Map<string, Entry<unknown>>;
  inFlight: Map<string, Promise<unknown>>;
}

// One budget and one cache per process, even when several route bundles each load their own copy of this module.
const STATE_KEY = Symbol.for("agari.finnhub.client");
const globalStore = globalThis as typeof globalThis & { [STATE_KEY]?: ClientState };
const state: ClientState = (globalStore[STATE_KEY] ??= { callsAtMs: [], cache: new Map(), inFlight: new Map() });

function apiKey(): string | null {
  const key = process.env.FINNHUB_API_KEY?.trim();
  return key ? key : null;
}

export function finnhubConfigured(): boolean {
  return apiKey() !== null;
}

/** Spends one call from the shared 60 s window, or says there is none left. */
function takeCall(nowMs: number): boolean {
  state.callsAtMs = state.callsAtMs.filter((atMs) => nowMs - atMs < WINDOW_MS);
  if (state.callsAtMs.length >= CALLS_PER_WINDOW) return false;
  state.callsAtMs.push(nowMs);
  return true;
}

async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
  const key = apiKey();
  if (!key) return null;
  const url = new URL(`${BASE_URL}/${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  try {
    const response = await fetch(url, { headers: { "X-Finnhub-Token": key }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/**
 * A cached read: fresh → the cache; otherwise one budgeted call. A failed or unaffordable refresh falls back to the
 * last good value while it is younger than `staleLimitMs`, then to `null`.
 */
function cachedRead<T>(cacheKey: string, ttlMs: number, staleLimitMs: number, load: () => Promise<T | null>): Promise<T | null> {
  if (!finnhubConfigured()) return Promise.resolve(null);
  const nowMs = Date.now();
  const entry = state.cache.get(cacheKey) as Entry<T> | undefined;
  if (entry && nowMs - entry.fetchedAtMs < ttlMs) return Promise.resolve(entry.value);
  const fallback = entry && nowMs - entry.fetchedAtMs < staleLimitMs ? entry.value : null;

  const pending = state.inFlight.get(cacheKey) as Promise<T | null> | undefined;
  if (pending) return pending;
  if (!takeCall(nowMs)) return Promise.resolve(fallback);

  const read = load()
    .catch(() => null)
    .then((value) => {
      if (value === null) return fallback;
      state.cache.set(cacheKey, { value, fetchedAtMs: Date.now() });
      return value;
    })
    .finally(() => state.inFlight.delete(cacheKey));
  state.inFlight.set(cacheKey, read);
  return read;
}

const rawArticleSchema = z.object({
  headline: z.string(),
  source: z.string(),
  url: z.string(),
  datetime: z.number(),
  related: z.string().nullish(),
});

/** Finnhub rows → articles, newest first. A malformed row is dropped, not the feed. */
function toArticles(body: unknown, sinceSec = 0): FinnhubArticle[] | null {
  if (!Array.isArray(body)) return null;
  const articles: FinnhubArticle[] = [];
  for (const row of body) {
    const parsed = rawArticleSchema.safeParse(row);
    if (!parsed.success) continue;
    const { headline, source, url, datetime, related } = parsed.data;
    const publishedAtSec = Math.floor(datetime);
    if (!headline.trim() || !/^https?:\/\//.test(url) || publishedAtSec < sinceSec) continue;
    const symbols = (related ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    articles.push({ title: headline.trim(), source: source.trim(), url, publishedAtSec, symbols });
  }
  return articles.sort((a, b) => b.publishedAtSec - a.publishedAtSec).slice(0, KEEP_ARTICLES);
}

/** `news?category=general`: the market-wide wire (Reuters, CNBC, Bloomberg). Cached 300 s. */
export function marketNews(): Promise<FinnhubArticle[] | null> {
  return cachedRead("news:general", MARKET_NEWS_TTL_MS, STALE_LIMIT_MS.market, async () => toArticles(await getJson("news", { category: "general" })));
}

const utcDate = (sec: number): string => new Date(sec * 1000).toISOString().slice(0, 10);

/** `company-news` for one ticker over the last 48 h. Cached 900 s. */
export function companyNews(symbol: TickerSymbol): Promise<FinnhubArticle[] | null> {
  return cachedRead(`news:company:${symbol}`, COMPANY_NEWS_TTL_MS, STALE_LIMIT_MS.company, async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const sinceSec = nowSec - COMPANY_LOOKBACK_SEC;
    const body = await getJson("company-news", { symbol, from: utcDate(sinceSec), to: utcDate(nowSec) });
    return toArticles(body, sinceSec);
  });
}

const earningsSchema = z.object({
  earningsCalendar: z.array(z.object({ symbol: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hour: z.string().nullish() })),
});

function hourOf(raw: string | null | undefined): EarningsEvent["hour"] {
  return raw === "bmo" || raw === "amc" || raw === "dmh" ? raw : null;
}

/** One ticker's reports from today (ET) to the lookahead, oldest first. Cached 6 h. */
function upcomingEarnings(symbol: TickerSymbol): Promise<EarningsEvent[] | null> {
  return cachedRead(`earnings:${symbol}`, EARNINGS_TTL_MS, STALE_LIMIT_MS.earnings, async () => {
    const todayEt = etDateOf(Math.floor(Date.now() / 1000));
    const parsed = earningsSchema.safeParse(await getJson("calendar/earnings", { symbol, from: todayEt, to: addDays(todayEt, EARNINGS_LOOKAHEAD_DAYS) }));
    if (!parsed.success) return null;
    return parsed.data.earningsCalendar
      .filter((row) => row.symbol === symbol)
      .map((row): EarningsEvent => ({ symbol, dateEt: row.date, hour: hourOf(row.hour) }))
      .sort((a, b) => a.dateEt.localeCompare(b.dateEt));
  });
}

/**
 * The next reports within `days` (today ET included) for the given tickers, soonest first. `null` when any ticker's
 * calendar can't be read: an incomplete answer would read as "no earnings", which is worse than "unknown".
 */
export async function earningsWithin(symbols: readonly TickerSymbol[], days: number): Promise<EarningsEvent[] | null> {
  const unique = [...new Set(symbols)].filter(isTickerSymbol);
  const reads = await Promise.all(unique.map(upcomingEarnings));
  if (reads.some((read) => read === null)) return null;
  const todayEt = etDateOf(Math.floor(Date.now() / 1000));
  const lastEt = addDays(todayEt, Math.min(Math.max(0, Math.floor(days)), EARNINGS_LOOKAHEAD_DAYS));
  return reads
    .flatMap((read) => read ?? [])
    .filter((event) => event.dateEt >= todayEt && event.dateEt <= lastEt)
    .sort((a, b) => a.dateEt.localeCompare(b.dateEt) || a.symbol.localeCompare(b.symbol));
}
