"use client";

import { TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import { diagnosis, err, ok, type Reading } from "@agari/core";
import { useReadingQuery } from "@agari/markets/react";
import { z } from "zod";
import { newsPayloadSchema, type Article } from "@/features/news/protocol";

/**
 * The hub's two wire reads, on the keys spec §4 gives them and in exactly the cache shape lane 13c's `useNews(symbol)`
 * and `useEarnings(symbol)` store (a `Reading` of the parsed payload), so a tab that mounts both never finds the other's
 * data under a shared key. At the 13c/13d merge these can be swapped for 13c's hooks without touching the screen.
 */
const NEWS_POLL_MS = 60_000;
/** Spec §4: earnings are read once per 6 h. */
const EARNINGS_STALE_MS = 6 * 3_600_000;

async function readNews(symbol: TickerSymbol): Promise<Reading<Article[]>> {
  const response = await fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
  if (!response.ok) return err(diagnosis("unknown", `news route answered ${response.status}`));
  const parsed = newsPayloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "news payload did not parse"));
  return ok(parsed.data.articles, Date.now());
}

/** One ticker's headlines (`["agari","news", symbol]`), polled while the tab is visible; a failed refresh keeps the last ones. */
/** Null for a basket (S19): a group of companies has no wire of its own, so nothing is asked. */
export function useTickerNews(symbol: TickerSymbol | null): Reading<Article[]> | null {
  return useReadingQuery(["agari", "news", symbol], () => readNews(symbol as TickerSymbol), { pollMs: NEWS_POLL_MS, enabled: symbol !== null, needs: [] });
}

/** `GET /api/earnings?symbol` (lane 13c): `lib/finnhub.server.ts`'s `EarningsEvent` list and the day the answer covers through. */
const earningsPayloadSchema = z.object({
  events: z.array(z.object({ symbol: z.enum(TICKER_SYMBOLS), dateEt: z.string(), hour: z.enum(["bmo", "amc", "dmh"]).nullable() })),
  throughDateEt: z.string(),
});
type EarningsPayload = z.infer<typeof earningsPayloadSchema>;

async function readEarnings(symbol: TickerSymbol): Promise<Reading<EarningsPayload>> {
  const response = await fetch(`/api/earnings?symbol=${encodeURIComponent(symbol)}`);
  if (!response.ok) return err(diagnosis("unknown", `earnings route answered ${response.status}`));
  const parsed = earningsPayloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "earnings payload did not parse"));
  return ok(parsed.data, Date.now());
}

/** The next report for one ticker: `known` once the calendar answered (an empty answer is a real "none scheduled"). */
export function useNextEarnings(symbol: TickerSymbol | null): { event: EarningsPayload["events"][number] | null; known: boolean } {
  const reading = useReadingQuery(["agari", "social", "earnings", symbol], () => readEarnings(symbol as TickerSymbol), { staleTimeMs: EARNINGS_STALE_MS, enabled: symbol !== null, needs: [] });
  if (!reading?.ok) return { event: null, known: false };
  const next = reading.value.events.filter((event) => event.symbol === symbol).sort((a, b) => (a.dateEt < b.dateEt ? -1 : 1))[0] ?? null;
  return { event: next, known: true };
}
