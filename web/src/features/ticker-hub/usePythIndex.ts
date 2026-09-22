"use client";

import { diagnosis, err, ok, type Reading } from "@agari/core";
import type { TickerSymbol } from "@agari/core/market";
import { useReadingQuery } from "@agari/markets/react";
import { z } from "zod";

const POLL_MS = 30_000;
const digits = z.string().regex(/^\d+$/).transform((text) => BigInt(text));

/** Whether the venue's key may read a name's valuation index (S20, D-125), as ops' hourly probe last found it. */
const entitlementSchema = z.object({
  state: z.enum(["entitled", "denied", "unknown"]),
  status: z.number().int().nullable(),
  checkedAtSec: z.number().nullable(),
  reason: z.string().nullable(),
});

/** One entitled name's index beside its PreStocks token price; absent for every name the key may not read. */
const rowSchema = z.object({
  indexE8: digits,
  publishTimeSec: z.number(),
  ageSec: z.number(),
  fresh: z.boolean(),
  tokenPriceE8: digits.nullable(),
  premiumBps: z.number().int().nullable(),
});

const payloadSchema = z.object({ entitlement: z.record(z.string(), entitlementSchema), rows: z.record(z.string(), rowSchema) });

export type PythIndexEntitlement = z.infer<typeof entitlementSchema>;
export type PythIndexRow = z.infer<typeof rowSchema>;
export type PythIndexView = z.infer<typeof payloadSchema>;

async function readPythIndex(): Promise<Reading<PythIndexView>> {
  const response = await fetch("/api/pyth-index", { cache: "no-store" });
  if (!response.ok) return err(diagnosis("unknown", `pyth-index route answered ${response.status}`));
  const parsed = payloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "pyth-index payload did not parse"));
  return ok(parsed.data, Date.now());
}

/** Every name's entitlement and index in one read (one memo on the server); off until a pre-IPO surface asks. */
export function usePythIndex(enabled: boolean): Reading<PythIndexView> | null {
  return useReadingQuery(["agari", "pyth-index", "latest"] as const, readPythIndex, { pollMs: POLL_MS, enabled, needs: [] });
}

/** The index row for a name, or null: a feed the key may not read, a failed read, or a name Pyth publishes no index for. */
export function pythIndexRowOf(reading: Reading<PythIndexView> | null, symbol: TickerSymbol): PythIndexRow | null {
  return reading?.ok ? (reading.value.rows[symbol] ?? null) : null;
}
