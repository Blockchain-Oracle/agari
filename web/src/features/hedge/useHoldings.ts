"use client";

import { SHARE_ISSUERS, SHARE_TOKENS, type ShareSymbol, type ShareToken, type TickerSymbol } from "@agari/core/market";
import { diagnosis, err, ok, type Reading } from "@agari/core";
import type { Address } from "@agari/core/types";
import { useReadingQuery } from "@agari/markets/react";
import { z } from "zod";

/** The route caches 60 s per owner; polling faster would only read its cache. */
const POLL_MS = 60_000;
const holdingsKey = (owner: Address | null) => ["agari", "hedge", "holdings", owner] as const;

/** One verified holding with its integers back as bigints. */
export interface HoldingView {
  mint: string;
  symbol: ShareSymbol;
  issuer: ShareToken["issuer"];
  underlying: TickerSymbol;
  sharesE8: bigint;
  /** Null when no price is known, or when the only known price is stale (`priceAgeSec` says how stale). */
  exposureUsdE6: bigint | null;
  /** Seconds since the price behind `exposureUsdE6` was published; null when no price is known. */
  priceAgeSec: number | null;
}

const digits = z.string().regex(/^\d+$/).transform((text) => BigInt(text));
const SYMBOLS = SHARE_TOKENS.map((token) => token.symbol) as [ShareSymbol, ...ShareSymbol[]];
const UNDERLYINGS = [...new Set(SHARE_TOKENS.map((token) => token.underlying))] as [TickerSymbol, ...TickerSymbol[]];

/** `GET /api/holdings` (`app/api/holdings/route.ts`): bigints travel as decimal strings. */
const rowSchema = z.object({
  mint: z.string(),
  symbol: z.enum(SYMBOLS),
  issuer: z.enum(SHARE_ISSUERS),
  underlying: z.enum(UNDERLYINGS),
  sharesE8: digits,
  exposureUsdE6: digits.nullable(),
  priceAgeSec: z.number().int().nonnegative().nullable().default(null),
});
// Rows parse one by one: a token this build does not know yet is dropped alone, instead of hiding every holding.
const bodySchema = z.object({ holdings: z.array(z.unknown()) });

async function readHoldings(owner: Address): Promise<Reading<HoldingView[]>> {
  const response = await fetch(`/api/holdings?owner=${encodeURIComponent(owner)}`, { cache: "no-store" });
  if (!response.ok) return err(diagnosis("unknown", `holdings route answered ${response.status}`));
  const parsed = bodySchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "holdings payload did not parse"));
  const rows = parsed.data.holdings.map((row) => rowSchema.safeParse(row)).flatMap((r) => (r.success ? [r.data] : []));
  return ok(rows, Date.now());
}

/** The connected wallet's mainnet share tokens, read-only; never persisted (the read cache's allowlist refuses account data). */
export function useHoldings(owner: Address | null): Reading<HoldingView[]> | null {
  return useReadingQuery(holdingsKey(owner), () => readHoldings(owner as Address), { pollMs: POLL_MS, enabled: owner !== null, needs: [] });
}
