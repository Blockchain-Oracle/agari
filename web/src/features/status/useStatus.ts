"use client";

import { diagnosis, err, ok, type Reading } from "@masayume/core";
import { useReadingQuery } from "@masayume/markets/react";
import { statusPayloadSchema, type StatusPayload } from "./protocol";

/** The reference re-checks every 30 s (`app/status/page.tsx` L28). */
const POLL_MS = 30_000;
export const STATUS_KEY = ["masayume", "status"] as const;

async function readStatus(): Promise<Reading<StatusPayload>> {
  const response = await fetch("/api/status", { cache: "no-store" });
  if (!response.ok) return err(diagnosis("unknown", `status route answered ${response.status}`));
  const parsed = statusPayloadSchema.safeParse(await response.json());
  if (!parsed.success) return err(diagnosis("unknown", "status payload did not parse"));
  return ok(parsed.data, Date.now());
}

/** Polled while the tab is visible; a hidden tab probes nothing. */
export function useStatus(): Reading<StatusPayload> | null {
  return useReadingQuery(STATUS_KEY, readStatus, { pollMs: POLL_MS, needs: [] });
}
