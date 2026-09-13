import { DECK_MIN, nextDealableSec, type DeckCandidate, type DeckPolicy } from "@masayume/core/games";
import { phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import { closeRuntime, ensureMarkets, marketsProvider, parseMarketsEnv, resolveVenueId } from "@masayume/markets";
import { getArenaState } from "@masayume/markets/games";
import { dealHeadroomSec } from "../actors/matchmaker/deckmaster";
import { finish } from "./finish";

/**
 * How often can a deck actually be dealt on this venue?
 *
 * The question that decided the arena's parameters on 2026-09-03. Somnia runs two assets with one Window
 * per cadence, and the arena checks card life at reveal — so a 15m Window is only usable for the part of
 * its cycle that outlasts join + reveal + card life. At `minDeckSize` 3 that left the duel dealable 40%
 * of the time; the owner's answer was a floor of two and tighter windows.
 *
 *   pnpm --filter @masayume/ops spike:deck-supply
 *
 * The venue's schedule is deterministic — a Window expires at E and its successor runs E → E+interval —
 * so one read projects the whole hour. `DECK_MIN`, `HORIZON_SEC` and the arena's own parameters can be
 * overridden to compare configurations before one is written on chain.
 */
const HORIZON_SEC = Number(process.env.HORIZON_SEC ?? 3_600);
const SPAN_SEC = Number(process.env.SPAN_SEC ?? 3_600);
const CADENCES = (process.env.CADENCES ?? "900,3600").split(",").map(Number);

async function main(): Promise<void> {
  const env = parseMarketsEnv();
  ensureMarkets(env);

  const state = await getArenaState();
  if (!isOk(state) || !state.value) throw new Error("no arena on this network");
  const params = {
    minCardLifeSec: Number(process.env.MIN_CARD_LIFE_SEC ?? state.value.params.minCardLifeSec),
    joinWindowSec: Number(process.env.JOIN_WINDOW_SEC ?? state.value.params.joinWindowSec),
    revealWindowSec: Number(process.env.REVEAL_WINDOW_SEC ?? state.value.params.revealWindowSec),
    pickWindowSec: Number(process.env.PICK_WINDOW_SEC ?? state.value.params.pickWindowSec),
  };
  const headroomSec = dealHeadroomSec(params);

  const venue = await resolveVenueId(env.venueId);
  if (!isOk(venue) || !venue.value.venueId) throw new Error("no live venue");
  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!isOk(lanes)) throw new Error("lanes unreadable");

  const nowMs = marketsProvider.nowMs();
  const nowSec = Math.floor(nowMs / 1_000);
  const pool: DeckCandidate[] = lanes.value.lanes
    .flatMap((lane) => lane.markets)
    .filter((market) => CADENCES.includes(market.intervalSec))
    .map((market) => ({
      marketId: market.marketId,
      asset: market.asset,
      intervalSec: market.intervalSec,
      expirySec: market.expirySec,
      trading: phase(market, nowMs) === "trading",
      spreadRaw: 0n,
      depthRaw: 1n,
    }));

  const policy: DeckPolicy = {
    supportedAssets: [...new Set(pool.map((c) => c.asset))],
    maxSpreadRaw: 2n ** 128n,
    minDepthRaw: 0n,
    horizonSec: HORIZON_SEC,
    minHeadroomSec: headroomSec,
  };

  console.log(`arena: minCardLife ${params.minCardLifeSec}s · join ${params.joinWindowSec}s · reveal ${params.revealWindowSec}s`);
  console.log(`deck:  min ${DECK_MIN} cards · horizon ${HORIZON_SEC}s · headroom at deal ${headroomSec}s\n`);
  for (const candidate of [...pool].sort((a, b) => a.expirySec - b.expirySec)) {
    console.log(`  ${candidate.asset} ${candidate.intervalSec}s · expires in ${candidate.expirySec - nowSec}s · ${candidate.trading ? "trading" : "locked"}`);
  }

  /** One series projected to time `at`: its successor Window, and whether that one would qualify. */
  function eligibleAt(candidate: DeckCandidate, at: number): boolean {
    let expirySec = candidate.expirySec;
    while (expirySec <= at) expirySec += candidate.intervalSec;
    const leftSec = expirySec - at;
    return leftSec >= headroomSec && leftSec <= HORIZON_SEC;
  }

  let dealableSec = 0;
  const gaps: { fromSec: number; toSec: number }[] = [];
  let gapFromSec: number | null = null;
  for (let ahead = 0; ahead < SPAN_SEC; ahead += 1) {
    const eligible = pool.filter((candidate) => eligibleAt(candidate, nowSec + ahead)).length;
    if (eligible >= DECK_MIN) {
      dealableSec += 1;
      if (gapFromSec !== null) {
        gaps.push({ fromSec: gapFromSec, toSec: ahead });
        gapFromSec = null;
      }
    } else if (gapFromSec === null) gapFromSec = ahead;
  }
  if (gapFromSec !== null) gaps.push({ fromSec: gapFromSec, toSec: SPAN_SEC });

  const pct = ((dealableSec / SPAN_SEC) * 100).toFixed(1);
  const longestSec = gaps.reduce((most, gap) => Math.max(most, gap.toSec - gap.fromSec), 0);
  console.log(`\nDealable ${dealableSec}/${SPAN_SEC}s = ${pct}% of the next hour`);
  console.log(`Dead zones: ${gaps.map((g) => `${g.fromSec}–${g.toSec}s (${g.toSec - g.fromSec}s)`).join(", ") || "none"}`);
  const dealableNow = pool.filter((candidate) => eligibleAt(candidate, nowSec)).length >= DECK_MIN;
  const queueSays = dealableNow ? "dealable now" : `next deck in ${nextDealableSec(pool, policy, nowSec) ?? "—"}s`;
  console.log(`Longest gap: ${longestSec}s · the queue would say: ${queueSays}`);
  await closeRuntime();
}

void main()
  .then(() => finish(0))
  .catch((error: unknown) => {
    console.error(error);
    finish(1);
  });
