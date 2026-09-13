import { randomBytes } from "node:crypto";
import { phase } from "@masayume/core/lifecycle";
import type { EventMarket } from "@masayume/core/types";
import { oneUnit } from "@masayume/core/units";
import { createMemoryJournal, createSubmitterSession, marketsProvider, resolveVenueId } from "@masayume/markets";
import { runSpike } from "./lib/boot";

const STAKE_UNITS = 5n;
const json = (value: unknown) => JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);

function soonestTrading(markets: EventMarket[], nowMs: number): EventMarket | undefined {
  return markets.filter((m) => phase(m, nowMs) === "trading").sort((a, b) => a.expirySec - b.expirySec)[0];
}

/**
 * Proves the order lane on the live book with an unfunded random key: the quote kernel must produce a
 * real quote, and the lane must refuse before any popup (gas or collateral) with no transaction sent.
 */
await runSpike(async ({ env }) => {
  const session = await createSubmitterSession({
    env,
    authority: "user-wallet",
    signer: { privateKey: `0x${randomBytes(32).toString("hex")}` },
    journal: createMemoryJournal(),
  });
  const wallet = session.address;

  await marketsProvider.syncClock();
  const venue = await resolveVenueId(env.venueId);
  if (!venue.ok) throw new Error(venue.error.technical);
  if (!venue.value.venueId) throw new Error("no venue with live windows");
  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!lanes.ok) throw new Error(lanes.error.technical);

  const market = soonestTrading(lanes.value.lanes.flatMap((lane) => lane.markets), marketsProvider.nowMs());
  if (!market) throw new Error("no window is trading right now");
  console.log("window", market.marketId, market.asset, market.intervalSec, "expiry", market.expirySec);

  const stakeBase = STAKE_UNITS * oneUnit(market.decimals);
  const target = { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec };
  const quote = await marketsProvider.freshQuoteStake(target, "up", stakeBase);
  console.log("fresh quote", json(quote));
  if (!quote.ok || !quote.value) throw new Error("no quote on the live book");

  const { submitter } = session;
  const outcome = await submitter.submitOrder(
    { market, side: "up", stakeBase, displayedQuote: quote.value, wallet },
    (writePhase) => console.log("phase", writePhase),
  );
  console.log("submitOrder", json(outcome));
  console.log("unresolved", json(await submitter.journal.listUnresolved(wallet)));
  await session.dispose();
});
