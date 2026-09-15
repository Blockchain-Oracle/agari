"use client";

import { diagnosis, err, ok, type Reading } from "@agari/core";
import type { TickerSymbol } from "@agari/core/market";
import { useReadingQuery } from "@agari/markets/react";
import { earningsPayloadSchema, type EarningsPayload } from "./protocol";

/** The calendar moves once a day at most; the route and the Finnhub client both hold it for 6 h (spec §4). */
const STALE_MS = 6 * 3_600_000;

export const earningsKey = (symbol: TickerSymbol | null) => ["agari", "social", "earnings", symbol] as const;

async function readEarnings(symbol: TickerSymbol): Promise<Reading<EarningsPayload>> {
  const response = await fetch(`/api/earnings?symbol=${symbol}`);
  if (!response.ok) return err(diagnosis("unknown", `earnings route answered ${response.status}`));
  const parsed = earningsPayloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "earnings payload did not parse"));
  return ok(parsed.data, Date.now());
}

/** One ticker's next reports within the route's horizon (the ticker hub's "next earnings" line). Null before the first answer. */
export function useEarnings(symbol: TickerSymbol | null): Reading<EarningsPayload> | null {
  const reading = useReadingQuery(earningsKey(symbol), () => readEarnings(symbol as TickerSymbol), {
    enabled: symbol !== null,
    staleTimeMs: STALE_MS,
    needs: [],
  });
  return symbol === null ? null : reading;
}
