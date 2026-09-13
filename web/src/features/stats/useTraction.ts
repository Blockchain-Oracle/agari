"use client";

import { diagnosis, err, ok, type Reading } from "@masayume/core";
import { useReadingQuery } from "@masayume/markets/react";
import { toTractionData, tractionPayloadSchema, type TractionData } from "./protocol";

/** The reference polls every 30 s; the route serves from the board's three-minute cache, so this is cheap. */
const POLL_MS = 30_000;
export const TRACTION_KEY = ["masayume", "traction"] as const;

async function readTraction(): Promise<Reading<TractionData>> {
  const response = await fetch("/api/traction", { cache: "no-store" });
  if (!response.ok) return err(diagnosis("indexer-down", `traction route answered ${response.status}`));
  const parsed = tractionPayloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("indexer-down", "traction payload did not parse"));
  return ok(toTractionData(parsed.data), Date.now());
}

export function useTraction(): Reading<TractionData> | null {
  return useReadingQuery(TRACTION_KEY, readTraction, { pollMs: POLL_MS, needs: [] });
}
