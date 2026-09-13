import { isOk } from "@masayume/core";
import { marketsProvider, resolveVenueId } from "@masayume/markets";
import { runSpike } from "./lib/boot";

const SETTLED_PAGE = 20;

/** The ids an endpoint check needs: the soonest live up/down Window and one settled Window, as JSON on the last line. */
await runSpike(async ({ env }) => {
  const venue = await resolveVenueId(env.venueId);
  if (!isOk(venue) || !venue.value.venueId) throw new Error("no venue");
  const [lanes, settled] = await Promise.all([marketsProvider.listLiveLanes(venue.value.venueId), marketsProvider.listSettled(venue.value.venueId, SETTLED_PAGE)]);
  if (!isOk(lanes)) throw new Error(`lanes: ${lanes.error.technical}`);
  if (!isOk(settled)) throw new Error(`settled: ${settled.error.technical}`);
  const live = lanes.value.lanes.flatMap((lane) => lane.markets).sort((a, b) => a.expirySec - b.expirySec)[0];
  const closed = settled.value.find((m) => m.isUpDown);
  console.log(JSON.stringify({ live: live?.marketId ?? null, liveExpirySec: live?.expirySec ?? null, closed: closed?.marketId ?? null }));
});
