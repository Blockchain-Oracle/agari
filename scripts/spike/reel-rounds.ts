import { formatCadence, isOk, phase, type MarketPhase } from "@masayume/core";
import { marketsProvider, resolveVenueId } from "@masayume/markets";
import { runSpike } from "./lib/boot";

/** Exactly the set `web/src/features/markets/reels/useReelRounds.ts` filters on. */
const IN_REEL: ReadonlySet<MarketPhase> = new Set<MarketPhase>(["pendingOpeningPrint", "trading", "noEntryBuffer"]);

/** What the reel would show right now, and what each excluded Window was excluded for. */
await runSpike(async ({ env }) => {
  const venue = await resolveVenueId(env.venueId);
  if (!isOk(venue) || !venue.value.venueId) throw new Error("no venue");
  console.log(`venue ${venue.value.venueId}`);

  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!isOk(lanes)) throw new Error(`lanes: ${lanes.error.technical}`);

  const nowMs = marketsProvider.nowMs();
  const all = lanes.value.lanes.flatMap((lane) => lane.markets);
  console.log(`lanes ${lanes.value.lanes.length} · markets ${all.length} · excludedFixedStrike ${lanes.value.excludedFixedStrike}`);

  const byPhase = new Map<MarketPhase, number>();
  for (const market of all) {
    const p = phase(market, nowMs);
    byPhase.set(p, (byPhase.get(p) ?? 0) + 1);
  }
  console.log("phases:", [...byPhase].map(([p, n]) => `${p}=${n}`).join(" "));

  const rounds = all.filter((m) => IN_REEL.has(phase(m, nowMs))).sort((a, b) => a.expirySec - b.expirySec);
  console.log(`\nreel would show ${rounds.length} card(s):`);
  for (const m of rounds) {
    const leftSec = m.expirySec - Math.floor(nowMs / 1000);
    console.log(`  ${m.asset} ${formatCadence(m.intervalSec)} · ${phase(m, nowMs)} · ${leftSec}s left · open=${m.openingPriceRaw ?? "pending"}`);
  }
});
