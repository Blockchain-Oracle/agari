/**
 * Lists the venue's live Windows with their time left — the id a fork test needs (`FORK_MARKET_ID`, decimal),
 * because a fork's clock is frozen at the fork block and only a Window that is Trading there will do.
 *
 *   pnpm --filter @masayume/scripts spike:live-windows
 */
import { phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import { marketsProvider, resolveVenueId } from "@masayume/markets";
import { runSpike } from "./lib/boot";
import { heading, table } from "./lib/markdown";

await runSpike(async ({ env }) => {
  const venue = await resolveVenueId(env.venueId);
  if (!isOk(venue) || !venue.value.venueId) throw new Error("no live venue");
  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!isOk(lanes)) throw new Error(lanes.error.technical);
  const nowMs = marketsProvider.nowMs();
  const rows = lanes.value.lanes
    .flatMap((lane) => lane.markets)
    .map((m) => ({ m, phase: phase(m, nowMs), leftSec: m.expirySec - Math.floor(nowMs / 1000) }))
    .sort((a, b) => b.leftSec - a.leftSec);
  console.log(heading(2, `Live Windows at ${new Date(nowMs).toISOString()}`));
  console.log(
    table(
      ["market id (decimal)", "asset", "cadence s", "phase", "seconds left", "pool"],
      rows.map(({ m, phase: p, leftSec }) => [BigInt(m.marketId).toString(), m.asset, String(m.intervalSec), p, String(leftSec), m.poolAddress]),
    ),
  );
});
