/**
 * Does the venue's book cross? `/surface` saw the 5m BTC book with its best bid above its best ask
 * (context/48). Reads the contract's own `getBookLevels` view (which skips expired makers itself) and
 * the SDK's live store side by side, three passes six seconds apart, on the BTC lanes up to 15m.
 *
 *   pnpm --filter @masayume/scripts spike:book-cross
 */
import { isOk } from "@masayume/core/schemas";
import { marketsProvider, resolveVenueId } from "@masayume/markets";
import { getClient } from "@masayume/markets/runtime";
import { runSpike } from "./lib/boot";

const fmt = (levels: { price: bigint; quantity: bigint }[]) => levels.slice(0, 4).map((l) => `${(Number(l.price) / 1e4).toFixed(2)}¢×${(Number(l.quantity) / 1e6).toFixed(0)}`).join(" ");

await runSpike(async ({ env }) => {
  const venue = await resolveVenueId(env.venueId);
  if (!isOk(venue) || !venue.value.venueId) throw new Error("no live venue");
  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!isOk(lanes)) throw new Error(lanes.error.technical);
  const targets = lanes.value.lanes.flatMap((l) => l.markets).filter((m) => m.asset === "BTC" && m.intervalSec <= 900);
  const client = getClient();
  const watches = await Promise.all(targets.map((m) => client.watchMarket(m.poolAddress)));
  await new Promise((r) => setTimeout(r, 4000));
  for (let i = 0; i < 3; i += 1) {
    const clock = await marketsProvider.syncClock();
    const offset = isOk(clock) ? clock.value.offsetMs : NaN;
    console.log(`\n## pass ${i + 1} · wall ${new Date().toISOString()} · chain offset ${offset} ms · live ws ${client.getLiveStatus().wsConnected}`);
    for (const m of targets) {
      const chain = await client.getBinaryOrderBook(m.poolAddress, { depth: 10, decimals: m.decimals });
      const live = client.getLiveBinaryOrderBookByMarket(m.marketId, { depth: 10 });
      const left = m.expirySec - Math.floor(marketsProvider.nowMs() / 1000);
      console.log(`${m.intervalSec}s · ${left}s left · ${m.poolAddress}`);
      console.log(`  chain bids ${fmt(chain.yesBids)} | asks ${fmt(chain.yesAsks)}`);
      console.log(`  live  bids ${fmt(live.yesBids)} | asks ${fmt(live.yesAsks)}`);
      const bestBid = chain.yesBids[0]?.price ?? null;
      const bestAsk = chain.yesAsks[0]?.price ?? null;
      if (bestBid !== null && bestAsk !== null && bestBid >= bestAsk) console.log("  CROSSED on chain");
    }
    await new Promise((r) => setTimeout(r, 6000));
  }
  for (const w of watches) w.stop();
});
