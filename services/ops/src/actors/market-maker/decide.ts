import { headroomSec } from "@masayume/core/lifecycle";
import { fairYesRaw, pairAround, quantizeQuantity, quoteExpiryNs, type MakerParams, type MakerWindowView, type Pair } from "@masayume/core/maker";
import type { EventMarket, MarketId, OnchainSnapshot } from "@masayume/core/types";
import type { PoolTop } from "@masayume/markets/maker";
import type { MakerEnv } from "./env";

/** What the actor last rested on a Window, so it requotes only when the book actually moved. */
export interface Placed extends Pair {
  fairRaw: bigint;
  tickRaw: bigint;
  expireNs: bigint;
}

export type WindowAction =
  | { kind: "settle"; marketId: MarketId; why: string }
  | { kind: "merge"; marketId: MarketId; why: string }
  | { kind: "hold"; marketId: MarketId; why: string };

/** An open Window: settle once the venue has, merge whenever both sides are held, else leave it. */
export function decideOpen(view: MakerWindowView, onchain: OnchainSnapshot): WindowAction {
  if (onchain.isResolved || onchain.isVoided) return { kind: "settle", marketId: view.marketId, why: "the venue settled the Window" };
  if (view.yesRaw > 0n && view.noRaw > 0n) {
    const pairs = view.yesRaw < view.noRaw ? view.yesRaw : view.noRaw;
    return { kind: "merge", marketId: view.marketId, why: `holding ${pairs} complete sets` };
  }
  return { kind: "hold", marketId: view.marketId, why: view.deployedBase === 0n ? "nothing deployed" : `${view.deployedBase} deployed, one-sided or resting` };
}

export type QuoteDecision =
  | { kind: "quote"; pair: Pair; quantityRaw: bigint; expireNs: bigint; pullFirst: boolean; why: string }
  | { kind: "skip"; why: string };

export interface QuoteInput {
  market: EventMarket;
  top: PoolTop;
  params: MakerParams;
  env: MakerEnv;
  one: bigint;
  nowSec: number;
  /** The vault's book on this Window, when it has one. */
  view: MakerWindowView | null;
  placed: Placed | null;
}

/** Whether to (re)quote a live Window now, and with what — every bound the contract enforces is checked here first. */
export function decideQuote(i: QuoteInput): QuoteDecision {
  const { market, top, params, env, one, nowSec, view, placed } = i;
  const left = market.expirySec - nowSec;
  const floor = Math.max(params.minTimeLeftSec, headroomSec(market.intervalSec));
  if (left < floor) return { kind: "skip", why: `${left}s left, under the ${floor}s floor` };
  if (top.tickRaw === 0n) return { kind: "skip", why: "the pool reports no tick grid" };

  const fair = fairYesRaw(top.bestBidRaw, top.bestAskRaw, one);
  const pair = pairAround({
    fairRaw: fair,
    halfSpreadRaw: env.halfSpreadRaw,
    tickRaw: top.tickRaw,
    minSpreadRaw: params.minSpreadRaw,
    minPriceRaw: params.minPriceRaw,
    maxPriceRaw: params.maxPriceRaw,
    bestBidRaw: top.bestBidRaw,
    bestAskRaw: top.bestAskRaw,
  });
  if (!pair) return { kind: "skip", why: `no admissible pair around ${fair} (book ${top.bestBidRaw ?? "-"} / ${top.bestAskRaw ?? "-"})` };

  const wanted = BigInt(env.quoteSize) * one;
  const capped = wanted < params.maxQuantityRaw ? wanted : params.maxQuantityRaw;
  const quantityRaw = quantizeQuantity(capped, top.lotRaw, top.minQuantityRaw);
  if (quantityRaw === 0n) return { kind: "skip", why: `${capped} rounds below the pool's minimum ${top.minQuantityRaw}` };

  const expireNs = quoteExpiryNs(nowSec, market.expirySec, env.quoteTtlSec);
  const pullFirst = (view?.quoteCount ?? 0) > 0;
  if (placed) {
    const moved = fair > placed.fairRaw ? fair - placed.fairRaw : placed.fairRaw - fair;
    const stale = placed.expireNs <= BigInt(nowSec + Math.ceil(env.refreshMs / 1000)) * 1_000_000_000n;
    if (moved < BigInt(env.requoteTicks) * top.tickRaw && !stale) {
      return { kind: "skip", why: `resting ${placed.bidYesRaw} / ${placed.askYesRaw}; fair moved ${moved}, under ${env.requoteTicks} ticks` };
    }
  }
  return { kind: "quote", pair, quantityRaw, expireNs, pullFirst, why: `fair ${fair} → ${pair.bidYesRaw} / ${pair.askYesRaw} × ${quantityRaw}` };
}
