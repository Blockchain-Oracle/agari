"use client";

import type { TickerSymbol } from "@agari/core/market";
import { diagnosis, err, ok, type Reading } from "@agari/core";
import { useReadingQuery } from "@agari/markets/react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { newsPayloadSchema, type Article } from "@/features/news/protocol";
import type { EarningsEvent } from "@/lib/finnhub.server";

/** The wire's own cadence and key family (`useNews.ts`; spec §4 `["masayume","news", symbol?]`), with the same reading shape. */
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

/** One ticker's headlines, polled while the tab is visible; a failed refresh keeps the last ones. */
export function useTickerNews(symbol: TickerSymbol): Reading<Article[]> | null {
  return useReadingQuery(["masayume", "news", symbol], () => readNews(symbol), { pollMs: NEWS_POLL_MS, needs: [] });
}

const earningsSchema = z.object({
  events: z.array(z.object({ symbol: z.string(), dateEt: z.string(), hour: z.enum(["bmo", "amc", "dmh"]).nullable() })),
});

/** `GET /api/earnings?symbol=` (lane 13c): the next report, `null` while unknown or when the calendar can't be read. */
export function useNextEarnings(symbol: TickerSymbol): { event: Pick<EarningsEvent, "dateEt" | "hour"> | null; known: boolean } {
  const query = useQuery({
    queryKey: ["agari", "social", "earnings", symbol],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/earnings?symbol=${encodeURIComponent(symbol)}`, { signal });
      if (!response.ok) throw new Error(`earnings ${response.status}`);
      return earningsSchema.parse(await response.json()).events.filter((event) => event.symbol === symbol);
    },
    staleTime: EARNINGS_STALE_MS,
    retry: false,
  });
  const next = query.data?.slice().sort((a, b) => (a.dateEt < b.dateEt ? -1 : 1))[0] ?? null;
  return { event: next, known: query.isSuccess };
}
