import {
  PRACTICE_IDLE,
  PRACTICE_WATCH_SEC,
  practiceScore,
  practiceTransition,
  nextPracticeCard,
  selectPracticeDeck,
  type DeckCard,
  type Pick,
  type PracticeCandidate,
  type PracticeClose,
  type PracticeRound,
  type PracticeScore,
} from "@agari/core/games";
import { PRICE_STALE_AFTER_MS } from "@agari/core/constants";
import { isOk } from "@agari/core/schemas";
import type { AssetPrice } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";

/**
 * web's `features/games/practice/usePracticeRound.ts`, line for line (web imports these two hooks through the
 * markets barrel, which also exports DOM views, so they are imported from their own files here).
 *
 * One practice round, from the venue's live Windows to the scoreboard.
 *
 * The round's state is core's reducer; everything this hook adds is the live feed and the two
 * moments that read it — the entry price at a swipe, and the one close price for every card when
 * the watch ends. Both are real readings. If a reading is missing at either moment the card is not
 * scored rather than being given a made-up number, which is why `practiceScore` tolerates a missing
 * close in the first place.
 *
 * One phone-side difference from web: the deck is dealt only from Windows whose asset has a fresh live
 * price (the same staleness line the card face uses), so an asset the feed is not publishing is simply not
 * dealt, rather than dealt as a card that can never be played. Every candidate asset is probed for that.
 */

/** How long the probes get to report before "nothing priceable" is said instead of "dealing". */
const PRICE_GRACE_MS = 8_000;

function isFresh(price: AssetPrice | undefined, nowMs: number): boolean {
  return price !== undefined && nowMs - price.publishTimeSec * 1_000 <= PRICE_STALE_AFTER_MS;
}

export type PracticeReadiness =
  | { kind: "dealing" }
  /** The venue answered and had nothing with enough life left — a schedule fact, not a fault. */
  | { kind: "no-deck" }
  | { kind: "unreadable" }
  | { kind: "ready" };

export interface PracticeSession {
  round: PracticeRound;
  readiness: PracticeReadiness;
  active: DeckCard | null;
  /** The live price per asset in the deck, as the probes report it. */
  priceOf: (asset: string) => AssetPrice | null;
  playedSide: (cardIndex: number) => Pick | null;
  /** Every asset the deck needs a feed for — one probe is mounted per entry. */
  assets: readonly string[];
  pick: (card: DeckCard, side: Pick) => void;
  deal: () => void;
  reportPrice: (price: AssetPrice) => void;
  watchLeftSec: number;
  score: PracticeScore | null;
  nowMs: number;
}

function freshSeed(): string {
  const c = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Only reached where `crypto` is absent. The bot is a coin flip either way; this is not a security seed.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function usePracticeRound(): PracticeSession {
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const nowMs = useChainNowMs();
  const [round, dispatch] = useReducer(practiceTransition, PRACTICE_IDLE);
  const [prices, setPrices] = useState<ReadonlyMap<string, AssetPrice>>(new Map());
  /** Bumped by "New deck" so a fresh deal can be asked for from a round that already dealt. */
  const [dealNonce, setDealNonce] = useState(0);
  const dealtFor = useRef(-1);

  const candidates = useMemo<readonly PracticeCandidate[] | null>(() => {
    if (!lanes) return null;
    if (!isOk(lanes)) return null;
    return lanes.value.lanes.flatMap((lane) =>
      lane.markets.map((market) => ({
        marketId: market.marketId,
        asset: market.asset,
        intervalSec: market.intervalSec,
        expirySec: market.expirySec,
        trading: market.status === "Trading",
      })),
    );
  }, [lanes]);

  /**
   * One deal per nonce, and only once the venue and the clock have both answered — dealing against a
   * zero clock would judge every Window's remaining life against 1970.
   *
   * The effect re-runs on every tick and every lane poll, and that is what makes it self-healing: a
   * venue with nothing dealable right now simply keeps failing the length check until a Window opens,
   * and the first deal that succeeds claims the nonce and stops.
   */
  useEffect(() => {
    if (dealtFor.current === dealNonce && round.cards.length > 0) return;
    if (!candidates || nowMs === 0) return;
    const priced = candidates.filter((c) => isFresh(prices.get(c.asset), nowMs));
    const cards = selectPracticeDeck(priced, Math.floor(nowMs / 1_000));
    if (cards.length === 0) return;
    dealtFor.current = dealNonce;
    dispatch({ kind: "deal", seed: freshSeed(), cards });
  }, [dealNonce, candidates, nowMs, round.cards.length, prices]);

  /** When the venue's candidates first arrived, so the probes get a grace period to report. */
  const candidatesAtMs = useRef(0);
  if (candidates && nowMs > 0 && candidatesAtMs.current === 0) candidatesAtMs.current = nowMs;

  const deal = useCallback(() => setDealNonce((n) => n + 1), []);

  const reportPrice = useCallback((price: AssetPrice) => {
    setPrices((prior) => {
      const held = prior.get(price.asset);
      if (held && held.priceRaw === price.priceRaw && held.publishTimeSec === price.publishTimeSec) return prior;
      const next = new Map(prior);
      next.set(price.asset, price);
      return next;
    });
  }, []);

  const priceOf = useCallback((asset: string) => prices.get(asset) ?? null, [prices]);

  const pick = useCallback(
    (card: DeckCard, side: Pick) => {
      const price = prices.get(card.asset);
      // No reading, no entry. A swipe that cannot be priced is refused rather than dated at zero.
      if (!price) return;
      dispatch({ kind: "pick", pick: { cardIndex: card.index, side, entryRaw: price.priceRaw, decimals: price.decimals, atMs: Date.now() } });
    },
    [prices],
  );

  // The watch closes once, on the clock the last swipe started. Reading `prices` here rather than
  // holding a subscription means the close is whatever the feed last said at that moment.
  useEffect(() => {
    if (round.phase !== "watching" || round.watchEndsAtMs === null) return;
    const left = round.watchEndsAtMs - Date.now();
    const id = setTimeout(() => {
      const closes: PracticeClose[] = [];
      for (const card of round.cards) {
        const price = prices.get(card.asset);
        if (price) closes.push({ cardIndex: card.index, closeRaw: price.priceRaw });
      }
      dispatch({ kind: "score", closes });
    }, Math.max(0, left));
    return () => clearTimeout(id);
  }, [round.phase, round.watchEndsAtMs, round.cards, prices]);

  const playedSide = useCallback((cardIndex: number) => round.picks.find((p) => p.cardIndex === cardIndex)?.side ?? null, [round.picks]);

  // Every candidate's asset is probed (the deal needs to know which are priced), plus the dealt deck's.
  const assets = useMemo(
    () => [...new Set([...(candidates ?? []).map((c) => c.asset), ...round.cards.map((card) => card.asset)])],
    [candidates, round.cards],
  );

  const readiness = useMemo<PracticeReadiness>(() => {
    if (round.cards.length > 0) return { kind: "ready" };
    if (lanes && !isOk(lanes)) return { kind: "unreadable" };
    if (candidates === null || nowMs === 0) return { kind: "dealing" };
    if (nowMs - candidatesAtMs.current < PRICE_GRACE_MS) return { kind: "dealing" };
    return { kind: "no-deck" };
  }, [round.cards.length, lanes, candidates, nowMs]);

  const watchLeftSec =
    round.phase === "watching" && round.watchEndsAtMs !== null && nowMs > 0
      ? Math.max(0, Math.ceil((round.watchEndsAtMs - nowMs) / 1_000))
      : PRACTICE_WATCH_SEC;

  return {
    round,
    readiness,
    active: nextPracticeCard(round),
    priceOf,
    playedSide,
    assets,
    pick,
    deal,
    reportPrice,
    watchLeftSec,
    score: round.phase === "scored" ? practiceScore(round) : null,
    nowMs,
  };
}
