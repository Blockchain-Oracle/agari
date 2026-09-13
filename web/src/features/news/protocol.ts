import { z } from "zod";

export const SENTIMENTS = ["positive", "negative", "neutral"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const articleSchema = z.object({
  title: z.string(),
  source: z.string(),
  url: z.string(),
  publishedAt: z.string(),
  sentiment: z.enum(SENTIMENTS),
});

export const newsPayloadSchema = z.object({
  articles: z.array(articleSchema),
  error: z.string().optional(),
});

export type Article = z.infer<typeof articleSchema>;
export type NewsPayload = z.infer<typeof newsPayloadSchema>;
