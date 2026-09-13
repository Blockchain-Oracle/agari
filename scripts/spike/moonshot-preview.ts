/**
 * A Moonshot quoted by the live RangeReserve on Shannon, read-only: picks the soonest hub-backed Trading Window
 * with enough time left, solves the strike for the call, asks the contract's `previewOpen` for the band, and
 * checks the expiry's capacity for the lock. Nothing is signed. The plan's sanity check: a solved 5× LONG band
 * comes back with `probRaw ≤ 178,571` and a multiple ≥ 5.
 *
 *   pnpm --filter @masayume/scripts spike:moonshot                       (LONG ×5, payout 5)
 *   DIRECTION=short MULTIPLE=25 PAYOUT=1 ASSET=ETH MIN_LEFT_SEC=120 pnpm --filter @masayume/scripts spike:moonshot
 */
import { phase } from "@masayume/core/lifecycle";
import { isMoonshotRung, targetProbE6, type MoonshotDirection } from "@masayume/core/range";
import { isOk } from "@masayume/core/schemas";
import { formatBaseUnits, formatOracleRaw, oneUnit } from "@masayume/core/units";
import { getRangeReserveState, loadCollateral, marketsProvider, quoteMoonshotOnchain, readRangeCapacity, resolveVenueId, unwrap } from "@masayume/markets";
import { runSpike } from "./lib/boot";

const json = (value: unknown) => JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);
const DIRECTION: MoonshotDirection = process.env.DIRECTION === "short" ? "short" : "long";
const MULTIPLE = Number(process.env.MULTIPLE ?? 5);
const PAYOUT_UNITS = BigInt(process.env.PAYOUT ?? 5);
const ASSET = process.env.ASSET ?? "BTC";
const MIN_LEFT_SEC = Number(process.env.MIN_LEFT_SEC ?? 90);
const usd = (print: bigint) => `$${formatOracleRaw(print, 2, 2)}`;

await runSpike(async ({ env }) => {
  if (!isMoonshotRung(MULTIPLE)) throw new Error(`MULTIPLE must be one of the rungs, got ${MULTIPLE}`);
  const collateral = unwrap(await loadCollateral());
  const one = oneUnit(collateral.decimals);
  const money = (base: bigint) => `${formatBaseUnits(base, collateral.decimals)} ${collateral.symbol}`;
  const reserve = unwrap(await getRangeReserveState());
  if (!reserve) throw new Error("RangeReserve is not deployed on this network");
  console.log("reserve", json({ address: reserve.deployment.rangeReserve, liquid: money(reserve.liquidBase), locked: money(reserve.lockedBase), paused: reserve.paused }));

  const venue = await resolveVenueId(env.venueId);
  if (!isOk(venue) || !venue.value.venueId) throw new Error("no live venue");
  const lanes = unwrap(await marketsProvider.listLiveLanes(venue.value.venueId));
  const nowMs = marketsProvider.nowMs();
  const nowSec = Math.floor(nowMs / 1000);
  const window = lanes.lanes
    .flatMap((lane) => lane.markets)
    .filter((m) => m.asset === ASSET && phase(m, nowMs) === "trading" && m.expirySec - nowSec >= Math.max(MIN_LEFT_SEC, reserve.params.minTimeLeftSec))
    .sort((a, b) => a.expirySec - b.expirySec)[0];
  if (!window) throw new Error(`no Trading ${ASSET} Window with ${MIN_LEFT_SEC}s left`);
  const tauSec = window.expirySec - nowSec;
  console.log("window", json({ marketId: BigInt(window.marketId).toString(), asset: window.asset, cadenceSec: window.intervalSec, leftSec: tauSec }));

  const call = { direction: DIRECTION, multiple: MULTIPLE } as const;
  const quote = unwrap(await quoteMoonshotOnchain({ marketId: window.marketId, asset: window.asset }, call, { kind: "fixPayout", maxPayoutBase: PAYOUT_UNITS * one }, reserve.params, tauSec));
  const target = targetProbE6(MULTIPLE, reserve.params.marginBps);
  const opening = quote.openingPrint;
  const distanceBps = ((quote.band.strikePrint - opening) * 10_000n) / opening;
  console.log(
    "quote",
    json({
      call: `${DIRECTION} ×${MULTIPLE}`,
      openingPrint: usd(opening),
      strike: usd(quote.band.strikePrint),
      distanceBps: distanceBps.toString(),
      band: { low: quote.band.lowPrint.toString(), high: quote.band.highPrint.toString() },
      basis: quote.basis,
      probRaw: quote.quote.probRaw.toString(),
      targetProbE6: target.toString(),
      stake: money(quote.quote.stakeBase),
      payout: money(quote.quote.maxPayoutBase),
      multiplierMilli: quote.quote.multiplierMilli,
      houseLocked: money(quote.houseLockedBase),
      payoutCap: money(quote.payoutCapBase),
    }),
  );
  const holds = quote.quote.probRaw <= target && quote.quote.multiplierMilli >= MULTIPLE * 1000;
  console.log(holds ? `OK: probRaw ≤ ${target} and the contract pays ≥ ×${MULTIPLE}` : `NOT OK: the rung does not hold on the contract's figures`);

  const capacity = unwrap(await readRangeCapacity(quote.houseLockedBase, window.expirySec));
  console.log("capacity", json({ fits: capacity.fits, refusal: capacity.refusal?.technical ?? null, lockedByExpiry: money(capacity.lockedByExpiryBase), maxExpiryLocked: money(reserve.params.maxExpiryLockedBase) }));
  if (!holds) process.exitCode = 1;
});
