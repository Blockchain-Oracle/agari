import { TICKER_SYMBOLS } from "@agari/core/market";
import { z } from "zod";

export const SENTIMENTS = ["positive", "negative", "neutral"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const articleSchema = z.object({
  title: z.string(),
  source: z.string(),
  url: z.string(),
  publishedAt: z.string(),
  sentiment: z.enum(SENTIMENTS),
  /** Additive (S13): the registry tickers Finnhub relates the story to. */
  symbols: z.array(z.string()).optional(),
});

export const newsPayloadSchema = z.object({
  articles: z.array(articleSchema),
  error: z.string().optional(),
});

export type Article = z.infer<typeof articleSchema>;
export type NewsPayload = z.infer<typeof newsPayloadSchema>;

/** `GET /api/earnings?symbol`: `lib/finnhub.server.ts`'s `EarningsEvent`, as the wire carries it. */
export const earningsEventSchema = z.object({
  symbol: z.enum(TICKER_SYMBOLS),
  dateEt: z.string(),
  hour: z.enum(["bmo", "amc", "dmh"]).nullable(),
});

export const earningsPayloadSchema = z.object({
  events: z.array(earningsEventSchema),
  /** The last day (ET) the answer covers: no event before it means no report before it. */
  throughDateEt: z.string(),
});

export type EarningsPayload = z.infer<typeof earningsPayloadSchema>;

/** `GET /api/sentiment` (spec §5 `SentimentReading`): the Up share of taker lots, null below the fill floor. */
export const sentimentReadingSchema = z.object({
  upBps: z.number().int().min(0).max(10_000).nullable(),
  fills: z.number().int().min(0),
  windowSec: z.number().int(),
  asOfSec: z.number().int(),
});

export type SentimentReading = z.infer<typeof sentimentReadingSchema>;
