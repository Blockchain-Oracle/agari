"use client";

import { diagnosis, err, ok, type Reading } from "@agari/core";
import type { TickerSymbol } from "@agari/core/market";
import { useReadingQuery } from "@agari/markets/react";
import { z } from "zod";

const POLL_MS = 30_000;
const digits = z.string().regex(/^\d+$/).transform((text) => BigInt(text));

/** The token price's move over the feed's trailing window (≈ 2 h), in integer basis points; the "calm" judgement reads it. */
const moveSchema = z.object({ windowSec: z.number(), samples: z.number().int(), rangeBps: z.number().int(), changeBps: z.number().int() });
export type PreIpoMove = z.infer<typeof moveSchema>;

/** `GET /api/prestocks?symbol=` (plan Step 5): the facts only PreStocks has for a pre-IPO name. Any half may be missing. */
const factsSchema = z.object({
  tokenPriceE8: digits.optional(),
  markPriceE8: digits.optional(),
  premiumBps: z.number().int().nullable().optional(),
  ageSec: z.number().optional(),
  fresh: z.boolean().optional(),
  move: moveSchema.nullable().optional(),
  holders: z.number().int().nullable(),
  holdersMonthAgo: z.number().int().nullable(),
  week: z.string().nullable(),
});

export type PreIpoFactsView = z.infer<typeof factsSchema>;

async function readFacts(symbol: TickerSymbol): Promise<Reading<PreIpoFactsView>> {
  const response = await fetch(`/api/prestocks?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
  if (!response.ok) return err(diagnosis("unknown", `prestocks route answered ${response.status}`));
  const parsed = z.record(z.string(), factsSchema).safeParse(await response.json());
  const row = parsed.success ? parsed.data[symbol] : undefined;
  if (!row) return err(diagnosis("unknown", "prestocks payload did not parse"));
  return ok(row, Date.now());
}

async function readAllFacts(): Promise<Reading<Record<string, PreIpoFactsView>>> {
  const response = await fetch("/api/prestocks", { cache: "no-store" });
  if (!response.ok) return err(diagnosis("unknown", `prestocks route answered ${response.status}`));
  const parsed = z.record(z.string(), factsSchema).safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "prestocks payload did not parse"));
  return ok(parsed.data, Date.now());
}

/** Every pre-IPO name's facts in one read (the holdings surfaces judge "calm" from it); off until a pre-IPO holding exists. */
export function usePreIpoFactsAll(enabled: boolean): Reading<Record<string, PreIpoFactsView>> | null {
  return useReadingQuery(["agari", "prestocks", "facts", "all"] as const, readAllFacts, { pollMs: POLL_MS, enabled, needs: [] });
}

export function usePreIpoFacts(symbol: TickerSymbol | null): Reading<PreIpoFactsView> | null {
  return useReadingQuery(["agari", "prestocks", "facts", symbol] as const, () => readFacts(symbol as TickerSymbol), { pollMs: POLL_MS, enabled: symbol !== null, needs: [] });
}
