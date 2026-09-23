import { isTickerSymbol } from "@agari/core/market";
import { PRICE_STALE_AFTER_MS } from "@agari/core/constants";
import { PRACTICE_IDLE, PRACTICE_WATCH_SEC, nextPracticeCard, practiceScore, practiceTransition, selectPracticeDeck, type DeckCard, type Pick, type PracticeClose } from "@agari/core/games";
import { isOk } from "@agari/core/schemas";
import type { AssetPrice } from "@agari/core/types";
import { useAssetPrice, useLanes } from "@agari/markets/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { marketsEnv } from "~/lib/env";

/** Native presentation over the web game's shared, pure deck and scoring rules. */
export function usePractice() {
  const lanes = useLanes(marketsEnv.venueId ?? null);
  const nowMs = useChainNowMs();
  const [round, dispatch] = useReducer(practiceTransition, PRACTICE_IDLE);
  const [prices, setPrices] = useState<ReadonlyMap<string, AssetPrice>>(new Map());
  const [nonce, setNonce] = useState(0);
  const dealt = useRef(-1);
  const candidates = useMemo(() => lanes && isOk(lanes) ? lanes.value.lanes.flatMap((lane) => lane.markets.map((market) => ({ marketId: market.marketId, asset: market.asset, intervalSec: market.intervalSec, expirySec: market.expirySec, trading: market.status === "Trading" }))) : null, [lanes]);

  useEffect(() => {
    if (dealt.current === nonce && round.cards.length) return;
    if (!candidates || !nowMs) return;
    const cards = selectPracticeDeck(candidates, Math.floor(nowMs / 1000));
    if (!cards.length) return;
    dealt.current = nonce;
    dispatch({ kind: "deal", seed: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, cards });
  }, [candidates, nowMs, nonce, round.cards.length]);

  const reportPrice = useCallback((price: AssetPrice) => setPrices((prior) => {
    const held = prior.get(price.asset);
    if (held?.priceRaw === price.priceRaw && held.publishTimeSec === price.publishTimeSec) return prior;
    const next = new Map(prior); next.set(price.asset, price); return next;
  }), []);
  const pick = (card: DeckCard, side: Pick) => {
    const price = prices.get(card.asset);
    if (!price || Date.now() - price.publishTimeSec * 1000 > PRICE_STALE_AFTER_MS) return;
    dispatch({ kind: "pick", pick: { cardIndex: card.index, side, entryRaw: price.priceRaw, decimals: price.decimals, atMs: Date.now() } });
  };

  useEffect(() => {
    if (round.phase !== "watching" || round.watchEndsAtMs === null) return;
    const id = setTimeout(() => {
      const closes: PracticeClose[] = [];
      for (const card of round.cards) {
        const price = prices.get(card.asset);
        const pick = round.picks.find((row) => row.cardIndex === card.index);
        if (price && pick && price.publishTimeSec * 1000 > pick.atMs && Date.now() - price.publishTimeSec * 1000 <= PRICE_STALE_AFTER_MS) {
          closes.push({ cardIndex: card.index, closeRaw: price.priceRaw });
        }
      }
      dispatch({ kind: "score", closes });
    }, Math.max(0, round.watchEndsAtMs - Date.now()));
    return () => clearTimeout(id);
  }, [round, prices]);

  const assets = [...new Set(round.cards.map((card) => card.asset))];
  const active = nextPracticeCard(round);
  const score = round.phase === "scored" ? practiceScore(round) : null;
  const leftSec = round.phase === "watching" && round.watchEndsAtMs !== null ? Math.max(0, Math.ceil((round.watchEndsAtMs - (nowMs || Date.now())) / 1000)) : PRACTICE_WATCH_SEC;
  const readiness = round.cards.length ? "ready" : lanes === null ? "loading" : lanes.ok ? "between" : "offline";
  return { round, active, score, leftSec, readiness, assets, priceOf: (asset: string) => prices.get(asset) ?? null, pick, reportPrice, deal: () => setNonce((value) => value + 1) };
}

export function PriceProbe({ asset, onPrice }: { asset: string; onPrice: (price: AssetPrice) => void }) {
  const reading = useAssetPrice(isTickerSymbol(asset) ? asset : null);
  useEffect(() => { if (reading && isOk(reading) && reading.value) onPrice(reading.value); }, [reading, onPrice]);
  return null;
}
