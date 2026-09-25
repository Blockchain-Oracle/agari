import { NOTIFIED_OUTCOMES, OUTCOME_COLUMN } from "@agari/core/desk";
import { marketsProvider } from "@agari/markets";
import { useMemo } from "react";
import { useDeskView } from "@/features/desk/useDesk";
import { calmSet, holdsPreIpo } from "@/features/hedge/calm";
import { pickAllHedges } from "@/features/hedge/hedge-target";
import { useHoldings } from "@/features/hedge/useHoldings";
import { useLanesState } from "@/features/markets/lanes/useLanes";
import { useReelRounds } from "@/features/markets/reels/useReelRounds";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { useTakes } from "@/features/takes/useTakes";
import { weaveReel } from "@/features/takes/weave";
import { usePreIpoFactsAll } from "@/features/ticker-hub/usePreIpoFacts";
import { SESSION_COPY } from "@/lib/copy-session";
import { useWalletSession } from "@/lib/wallet-session";
import { useSessionPhrase } from "@/lib/when";
import type { DeskReelDecision } from "./FeedCards";

/** The desk decisions worth a card (plan §5.8): the ones that ring; a quiet check never reaches the reel. */
const NOTABLE = new Set<string>([...NOTIFIED_OUTCOMES].map((o) => OUTCOME_COLUMN[o]));

/**
 * Everything web's `ReelsScreen` reads before it draws: the live rounds from the lanes, the takes from the social
 * store, the wallet's stock tokens as "you hold this" picks, your own desk's latest notable decision, woven in the
 * reference's order (`weaveReel`), and — off-hours — the closed line that leads the reel.
 */
export function useReelFeed() {
  const venue = useVenue();
  const nowMs = useChainNowMs();
  const lanes = useLanesState(venue.venueId);
  const session = useMarketSession();
  const phrase = useSessionPhrase();
  const rounds = useReelRounds(lanes.laneSet, nowMs);

  const waiting = lanes.reading === null || nowMs === 0;
  const feed = useTakes(!waiting);
  const { address } = useWalletSession();
  const holdings = useHoldings(address);
  const facts = usePreIpoFactsAll(holdings?.ok === true && holdsPreIpo(holdings.value));
  const holdingPicks = useMemo(
    () => (holdings?.ok ? pickAllHedges(holdings.value, lanes.laneSet, nowMs, calmSet(facts?.ok ? facts.value : null)) : []),
    [holdings, lanes.laneSet, nowMs, facts],
  );
  const desk = useDeskView(address, address, address !== null);
  const deskDecision = useMemo<DeskReelDecision | null>(() => {
    if (!desk?.ok || !desk.value.desk) return null;
    const notable = desk.value.recent.find((r) => NOTABLE.has(r.outcome));
    return notable ? { deskId: desk.value.desk.id, record: notable, isLive: desk.value.desk.address !== null } : null;
  }, [desk]);
  const reel = useMemo(() => weaveReel(rounds, feed?.takes ?? [], holdingPicks, deskDecision), [rounds, feed, holdingPicks, deskDecision]);
  const closedLine =
    session && !session.open ? SESSION_COPY.sessionClosedLine(phrase(session.status, Math.floor((nowMs > 0 ? nowMs : marketsProvider.nowMs()) / 1000))) : null;

  return { venueId: venue.venueId, nowMs, laneSet: lanes.laneSet, waiting, reel, closedLine, configured: feed?.configured ?? null };
}
