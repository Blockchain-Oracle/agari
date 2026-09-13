import { err, isOk, ok, type Reading } from "@masayume/core/schemas";
import type { AgentContext, AgentSample } from "@masayume/core/strategies";
import { diagnosis, type EventMarket, type PricePoint, type Side } from "@masayume/core/types";
import { msToSec } from "@masayume/core/units";
import { marketsProvider } from "../provider";
import { openingOnFeedScale } from "./price-basis";

/** The prompt sees at most this many points over the Window so far. */
const MAX_SAMPLES = 12;

function toSample(p: PricePoint): AgentSample {
  return { atSec: p.blockTimestampSec, priceRaw: p.priceRaw };
}

/** Evenly spaced, first and last kept, so a long Window reads as a shape rather than a wall of ticks. */
export function downsample(points: readonly PricePoint[], max = MAX_SAMPLES): AgentSample[] {
  if (points.length <= max) return points.map(toSample);
  const last = points.length - 1;
  return Array.from({ length: max }, (_, i) => toSample(points[Math.round((i * last) / (max - 1))] as PricePoint));
}

/** Cents for one side at the stake, or null when the book has nothing fillable at this size (or cannot be read). */
async function sideCents(market: EventMarket, side: Side, stakeBase: bigint): Promise<number | null> {
  const target = { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec };
  const quote = await marketsProvider.freshQuoteStake(target, side, stakeBase);
  return isOk(quote) && !quote.stale && quote.value ? quote.value.oddsCents : null;
}

/**
 * Everything an agent's prompt sees about one Window, read fresh: the print, the feed's EMA and
 * spot, the price path since the print, and both books at the envelope's per-trade stake. Reads
 * only — nothing here can send, and nothing here is cached across calls, because a decision must
 * never be made on another moment's reading.
 */
export async function readAgentContext(market: EventMarket, stakeBase: bigint, nowMs: number): Promise<Reading<AgentContext>> {
  const nowSec = msToSec(nowMs);
  const [opening, price, history, upCents, downCents] = await Promise.all([
    marketsProvider.getOpeningPrice(market.marketId),
    marketsProvider.getAssetPrice(market.asset),
    marketsProvider.getPriceHistory(market.asset, market.tradingStartSec, nowSec),
    sideCents(market, "up", stakeBase),
    sideCents(market, "down", stakeBase),
  ]);
  if (!isOk(opening)) return opening;
  if (opening.stale) return err(diagnosis("indexer-down", "opening print refresh failed; holding"));
  if (opening.value === null) return err(diagnosis("market-not-trading", `${market.asset}/${market.intervalSec}s has no opening print yet`));
  if (!isOk(price)) return price;
  if (price.stale) return err(diagnosis("indexer-down", `${market.asset} price is stale; holding`));
  if (price.value === null) return err(diagnosis("indexer-down", `no fresh ${market.asset} price`));
  if (!isOk(history)) return history;
  if (history.stale) return err(diagnosis("indexer-down", `${market.asset} price history is stale; holding`));
  let openingRaw: bigint;
  try { openingRaw = openingOnFeedScale(opening.value, price.value.decimals); }
  catch { return err(diagnosis("indexer-down", "Opening print and price-feed units could not be reconciled; holding")); }
  return ok(
    {
      asset: market.asset,
      intervalSec: market.intervalSec,
      tradingStartSec: market.tradingStartSec,
      openingRaw,
      emaRaw: price.value.emaRaw,
      spotRaw: price.value.priceRaw,
      feedDecimals: price.value.decimals,
      samples: downsample(history.value),
      upCents,
      downCents,
      stakeBase,
      collateralDecimals: market.decimals,
      elapsedSec: Math.max(0, nowSec - market.tradingStartSec),
      leftSec: Math.max(0, market.expirySec - nowSec),
    },
    nowMs,
  );
}
