"use client";

import { diagnosis, err, ok, type Reading } from "@agari/core";
import type { TickerSymbol } from "@agari/core/market";
import { useReadingQuery } from "@agari/markets/react";
import { newsPayloadSchema, type Article } from "./protocol";

/** The reference refreshes the wire every minute (`NewsFeed.tsx` L65). */
const POLL_MS = 60_000;
export const NEWS_KEY = ["agari", "news"] as const;

/** Masayume's key, with the ticker appended when the wire is narrowed to one (spec §4). */
export const newsKey = (symbol: TickerSymbol | null) => (symbol ? ([...NEWS_KEY, symbol] as const) : NEWS_KEY);

async function readNews(symbol: TickerSymbol | null): Promise<Reading<Article[]>> {
  const response = await fetch(symbol ? `/api/news?symbol=${symbol}` : "/api/news", { cache: "no-store" });
  if (!response.ok) return err(diagnosis("unknown", `news route answered ${response.status}`));
  const parsed = newsPayloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "news payload did not parse"));
  return ok(parsed.data.articles, Date.now());
}

/**
 * Polled while the tab is visible. The reference keeps its last headlines when a refresh
 * fails ("silent — keep stale data"); the reading query does the same, flagging them stale.
 */
export function useNews(symbol: TickerSymbol | null = null): Reading<Article[]> | null {
  return useReadingQuery(newsKey(symbol), () => readNews(symbol), { pollMs: POLL_MS, needs: [] });
}
