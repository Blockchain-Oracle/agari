"use client";

import { useRouter } from "next/navigation";
import { useTick } from "@agari/markets/react";
import { examplePick, HEDGE, HedgeCard } from "@/features/hedge";
import { MARKETS_PATH } from "@/lib/routes";
import { LANDING } from "./copy";

/** The example refreshes its "mid-flight" Window once a minute, so it never shows a closed one. */
const TICK_MS = 60_000;

/**
 * The cover card on the landing page (plan Step 6): the same sample holdings the markets page's "See an example"
 * shows, through the real picker, stamped as an example. A tap goes to the markets page, where the real card lives.
 */
export function LandingCoverCard() {
  const router = useRouter();
  useTick(TICK_MS);
  const pick = examplePick(Math.floor(Date.now() / 1000));
  if (!pick) return null;
  return (
    <HedgeCard
      pick={pick}
      stakeBase={null}
      decimals={6}
      symbol="tUSDC"
      onSelect={() => router.push(MARKETS_PATH)}
      stamp={HEDGE.example.stamp}
      ctaText={LANDING.cover.cta}
      note={HEDGE.example.note}
    />
  );
}
