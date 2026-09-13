import { formatOracleRaw, isOk, neededMove, oneUnit, phase } from "@masayume/core";
import { marketsProvider, resolveVenueId } from "@masayume/markets";
import { ORACLE_PRICE_SCALE, PRICE_BASIS } from "@masayume/markets/identity";
import { runSpike, short } from "./lib/boot";

const HISTORY_LEAD_SEC = 60;
const DEPTH = 3;

/** Feed raw (10^decimals) → oracle cents; the same reconciliation the hero's units.ts performs. */
function feedToOracle(raw: bigint, feedDecimals: number): bigint {
  return raw / oneUnit(feedDecimals - ORACLE_PRICE_SCALE);
}

const dollars = (raw: bigint | null): string => (raw === null ? "—" : `$${formatOracleRaw(raw, ORACLE_PRICE_SCALE)}`);

/** Story 1.7 smoke: every read the hero composes, for the soonest-expiring live window, with units reconciled. */
await runSpike(async ({ env }) => {
  const venue = await resolveVenueId(env.venueId);
  if (!isOk(venue) || !venue.value.venueId) throw new Error("no venue");
  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!isOk(lanes)) throw new Error(`lanes: ${lanes.error.technical}`);
  const nowMs = marketsProvider.nowMs();
  const nowSec = Math.floor(nowMs / 1000);
  const market = lanes.value.lanes
    .flatMap((lane) => lane.markets)
    .filter((m) => m.expirySec > nowSec)
    .sort((a, b) => a.expirySec - b.expirySec)[0];
  if (!market) throw new Error("no live market");

  const [opening, onchain, history, live, book] = await Promise.all([
    marketsProvider.getOpeningPrice(market.marketId),
    marketsProvider.getOnchain(market.marketId),
    marketsProvider.getPriceHistory(market.asset, market.tradingStartSec - HISTORY_LEAD_SEC, market.expirySec),
    marketsProvider.getAssetPrice(market.asset),
    marketsProvider.getBookDepth({ marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals }, DEPTH),
  ]);

  const openingRaw = isOk(opening) ? opening.value : null;
  const livePrice = isOk(live) ? live.value : null;
  const latestRaw = livePrice ? feedToOracle(PRICE_BASIS === "ema" ? livePrice.emaRaw : livePrice.priceRaw, livePrice.decimals) : null;
  const points = isOk(history) ? history.value : [];
  const currentPhase = phase({ ...market, openingPriceRaw: openingRaw, onchainStatus: isOk(onchain) ? onchain.value.status : null }, nowMs);

  console.log(`market ${short(market.marketId)} ${market.asset} ${market.intervalSec}s · phase=${currentPhase} · expires in ${market.expirySec - nowSec}s`);
  console.log(`opening print (oracle, cents): ${dollars(openingRaw)} ${isOk(opening) ? "" : `[${opening.error.kind}]`}`);
  console.log(`live ${PRICE_BASIS} (feed ${livePrice?.decimals ?? "?"}dp → cents): ${dollars(latestRaw)} @ block ${livePrice?.blockTimestampSec ?? "?"}`);
  console.log(`history points since ${market.tradingStartSec - HISTORY_LEAD_SEC}: ${points.length}` + (points.length ? ` · first ${dollars(feedToOracle(points[0]!.emaRaw, livePrice?.decimals ?? 18))} · last ${dollars(feedToOracle(points.at(-1)!.emaRaw, livePrice?.decimals ?? 18))}` : ""));
  if (openingRaw !== null && latestRaw !== null) {
    const move = neededMove(latestRaw, openingRaw);
    console.log(`distance: UP needs +${dollars(move.upNeedsRaw)} · DOWN needs −${dollars(move.downNeedsRaw)} · leading ${move.leading}`);
  } else {
    console.log("distance: pending (no opening print or no live price)");
  }
  if (isOk(book)) {
    const fmt = (levels: { priceBps: number; quantityRaw: bigint }[]) => (levels.length ? levels.map((l) => `${Math.round(l.priceBps / 100)}¢×${formatOracleRaw(l.quantityRaw, market.decimals)}`).join(" ") : "empty");
    console.log(`book: buy UP [${fmt(book.value.upAsks.slice(0, DEPTH))}] · buy DOWN [${fmt(book.value.downAsks.slice(0, DEPTH))}]`);
  } else {
    console.log(`book: ${book.error.kind}`);
  }
});
