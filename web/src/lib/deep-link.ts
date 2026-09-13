"use client";

import { isSettled, phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import type { EventMarket, LaneSet, MarketId, Side } from "@masayume/core/types";
import { marketDeepLink, parseMarketsSearch } from "@masayume/core/urls";
import { useMarket, useNextWindow } from "@masayume/markets/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { formatCadence, MARKETS } from "@/lib/copy";
import { NOTE_KIND, NOTE_PARAM } from "@/lib/routes";
import { notify } from "@/lib/toast";

export interface DeepLinkResolution {
  marketId: MarketId | null;
  side: Side | null;
  /** The Window the link resolved to when it is not in the live lanes (a successor, or a Window from another scope). */
  market: EventMarket | null;
  resolving: boolean;
}

export function findMarket(lanes: LaneSet | null, marketId: MarketId | null): EventMarket | null {
  if (!lanes || !marketId) return null;
  for (const lane of lanes.lanes) {
    const hit = lane.markets.find((m) => m.marketId === marketId);
    if (hit) return hit;
  }
  return null;
}

function isDead(market: EventMarket, nowMs: number): boolean {
  const p = phase(market, nowMs);
  return p === "locked" || isSettled(p);
}

/** Fires each note once per distinct key — a re-render never repeats the toast. */
function useNoteOnce(key: string | null, text: string | null) {
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!key || !text || fired.current === key) return;
    fired.current = key;
    notify.neutral(text);
  }, [key, text]);
}

/**
 * Resolves `?m=&dir=` against the live lanes (UX-DR21): a live Window is used as-is; a dead one
 * resolves to its successor with a one-line note; a Window that no longer exists falls back to the lanes.
 */
export function useResolveDeepLink(lanes: LaneSet | null, nowMs: number): DeepLinkResolution {
  const params = useSearchParams();
  const { marketId: linked, dir } = parseMarketsSearch(params);
  const routeNote = params.get(NOTE_PARAM);

  const live = findMarket(lanes, linked);
  const clockReady = nowMs > 0;
  const needsLookup = linked !== null && lanes !== null && live === null && clockReady;
  const fetched = useMarket(needsLookup ? linked : null);
  const fetchedMarket = needsLookup && fetched && isOk(fetched) ? fetched.value : null;
  const dead = fetchedMarket && isDead(fetchedMarket, nowMs) ? fetchedMarket : null;
  const successor = useNextWindow(dead);
  const successorMarket = dead && successor && isOk(successor) ? successor.value : null;

  const gone = needsLookup && fetched !== null && isOk(fetched) && fetched.value === null;
  const settledNoSuccessor = dead !== null && successor !== null && isOk(successor) && successor.value === null;

  const note = routeNote === NOTE_KIND.moved
    ? { key: `moved`, text: MARKETS.notes.moved }
    : successorMarket
      ? { key: `successor:${dead?.marketId}`, text: MARKETS.notes.successor(formatCadence(successorMarket.intervalSec)) }
      : gone || settledNoSuccessor
        ? { key: `gone:${linked}`, text: MARKETS.notes.gone }
        : null;
  useNoteOnce(note?.key ?? null, note?.text ?? null);

  useEffect(() => {
    if (successorMarket) window.history.replaceState(null, "", marketDeepLink({ marketId: successorMarket.marketId, dir: dir ?? undefined }));
  }, [successorMarket, dir]);

  if (live) return { marketId: live.marketId, side: dir, market: live, resolving: false };
  if (successorMarket) return { marketId: successorMarket.marketId, side: dir, market: successorMarket, resolving: false };
  if (fetchedMarket && !dead) return { marketId: fetchedMarket.marketId, side: dir, market: fetchedMarket, resolving: false };
  const resolving = linked !== null && !gone && !settledNoSuccessor && (lanes === null || !clockReady || fetched === null || (dead !== null && successor === null));
  return { marketId: null, side: dir, market: null, resolving };
}
