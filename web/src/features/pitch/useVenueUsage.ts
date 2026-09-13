"use client";

import { useEffect, useState } from "react";
import { leaderboardPayloadSchema } from "@/features/leaderboard/protocol";

export type VenueUsage =
  | { state: "reading" }
  | { state: "unavailable" }
  | { state: "ok"; rankedTraders: number; closedCalls: number; complete: boolean; computedAtMs: number };

/**
 * The "real usage" slide reads the venue live — the same route `/leaderboard` serves,
 * replayed from the fill tape and cached three minutes — rather than a number typed
 * into a deck. Fetched at deck mount so the figure is usually in hand by slide ten;
 * a cold board takes tens of seconds, and the slide says "reading" until it lands.
 */
export function useVenueUsage(): VenueUsage {
  const [usage, setUsage] = useState<VenueUsage>({ state: "reading" });

  useEffect(() => {
    let alive = true;
    void fetch("/api/leaderboard")
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const parsed = leaderboardPayloadSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("shape");
        const { meta } = parsed.data;
        if (alive) setUsage({ state: "ok", rankedTraders: meta.rankedTraders, closedCalls: meta.closedCalls, complete: meta.complete, computedAtMs: meta.computedAtMs });
      })
      .catch(() => {
        if (alive) setUsage({ state: "unavailable" });
      });
    return () => {
      alive = false;
    };
  }, []);

  return usage;
}
