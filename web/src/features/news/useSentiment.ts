"use client";

import { diagnosis, err, ok, type Reading } from "@agari/core";
import { useReadingQuery } from "@agari/markets/react";
import { sentimentReadingSchema, type SentimentReading } from "./protocol";

/** Spec §4: the route shares an answer for 30 s; the marquee asks once a minute while the tab is visible. */
const POLL_MS = 60_000;
export const SENTIMENT_KEY = ["agari", "social", "sentiment"] as const;

async function readSentiment(): Promise<Reading<SentimentReading>> {
  const response = await fetch("/api/sentiment");
  if (!response.ok) return err(diagnosis("indexer-down", `sentiment route answered ${response.status}`));
  const parsed = sentimentReadingSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "sentiment payload did not parse"));
  return ok(parsed.data, Date.now());
}

/** The crowd-flow reading behind the marquee's sentiment cell. Null before the first answer. */
export function useSentiment(): Reading<SentimentReading> | null {
  return useReadingQuery(SENTIMENT_KEY, readSentiment, { pollMs: POLL_MS, needs: [] });
}
