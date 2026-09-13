"use client";

import { diagnosis, err, ok, type Reading } from "@masayume/core";
import { useReadingQuery } from "@masayume/markets/react";
import { newsPayloadSchema, type Article } from "./protocol";

/** The reference refreshes the wire every minute (`NewsFeed.tsx` L65). */
const POLL_MS = 60_000;
export const NEWS_KEY = ["masayume", "news"] as const;

async function readNews(): Promise<Reading<Article[]>> {
  const response = await fetch("/api/news", { cache: "no-store" });
  if (!response.ok) return err(diagnosis("unknown", `news route answered ${response.status}`));
  const parsed = newsPayloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "news payload did not parse"));
  return ok(parsed.data.articles, Date.now());
}

/**
 * Polled while the tab is visible. The reference keeps its last headlines when a refresh
 * fails ("silent — keep stale data"); the reading query does the same, flagging them stale.
 */
export function useNews(): Reading<Article[]> | null {
  return useReadingQuery(NEWS_KEY, readNews, { pollMs: POLL_MS, needs: [] });
}
