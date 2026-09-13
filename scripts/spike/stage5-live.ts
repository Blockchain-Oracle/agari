import { execSync } from "node:child_process";

import { type Hex } from "@masayume/core/types";
import { mulBpsCeil, oneUnit } from "@masayume/core/units";
import { RANGE_STAKE_HEADROOM_BPS } from "@masayume/core/range";
import {
  closeRuntime,
  configureMarkets,
  createMemoryJournal,
  createSubmitterSession,
  getLeverageMark,
  getLeverageReserveState,
  getMakerVaultState,
  getRangeReserveState,
  listLeveragePositionsOf,
  listRangesOf,
  loadCollateral,
  marketsProvider,
  parseMarketsEnv,
  previewRangeBasis,
  quoteRangeOnchain,
  resolveVenueId,
  sizeLeverageForStake,
  submitLeverageOpen,
  submitRangeOpen,
  unwrap,
} from "@masayume/markets";

/**
 * Drives the three Stage 5 reserves through the REAL adapter on Shannon: reads their live state, opens a 2×
 * boost of 10 and a range band of 5 on the soonest Trading Window with enough time left, reports the gas each
 * lane used, and — with WAIT=1 — waits for the Window to settle and cranks both positions (permissionless).
 *
 *   HOUSE_KEY=<funded key> pnpm --filter @masayume/scripts spike:stage5-live        (WAIT=1 to settle)
 */
const WAIT = process.env.WAIT === "1";
const BOOST = process.env.BOOST !== "0";
const RPC = process.env.RPC_HTTP_URLS ?? "https://dream-rpc.somnia.network";
const MIN_LEFT_SEC = Number(process.env.MIN_LEFT_SEC ?? 420);
const json = (value: unknown) => JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);
const gasOf = (hash: string) => Number(execSync(`cast receipt ${hash} gasUsed --rpc-url ${RPC}`, { encoding: "utf8" }).trim());

function expectStatus<T extends { status: string }>(label: string, outcome: T, ...ok: string[]): T {
  if (!ok.includes(outcome.status)) throw new Error(`${label}: ${json(outcome)}`);
  console.log(`${label}: ${outcome.status}`);
  return outcome;
}

const env = parseMarketsEnv({ rpcHttpUrls: RPC, venueId: process.env.VENUE_ID });
configureMarkets(env);

try {
  unwrap(await loadCollateral());
  await marketsProvider.syncClock();
  const [leverage, range, maker] = await Promise.all([getLeverageReserveState(), getRangeReserveState(), getMakerVaultState()]);
  const lev = unwrap(leverage);
  const rng = unwrap(range);
  const mm = unwrap(maker);
  if (!lev || !rng || !mm) throw new Error("a reserve is not deployed on this network");
  const one = oneUnit(lev.decimals);
  console.log("leverage reserve", json({ liquid: lev.liquidBase, outstanding: lev.outstandingBase, open: lev.openPositions, paused: lev.paused }));
  console.log("range reserve", json({ liquid: rng.liquidBase, locked: rng.lockedBase, paused: rng.paused }));
  console.log("maker vault", json({ liquid: mm.liquidBase, deployed: mm.deployedBase, maker: mm.maker, open: mm.openWindows.length }));

  const house = await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: process.env.HOUSE_KEY as Hex }, journal: createMemoryJournal() });
  console.log("house", house.address);

  const venue = unwrap(await resolveVenueId(env.venueId));
  if (!venue.venueId) throw new Error("no venue");
  const lanes = unwrap(await marketsProvider.listLiveLanes(venue.venueId));
  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  const window = lanes.lanes
    .flatMap((lane) => lane.markets)
    .filter((m) => m.status === "Trading" && m.expirySec - nowSec >= MIN_LEFT_SEC)
    .sort((a, b) => a.expirySec - b.expirySec)[0];
  if (!window) throw new Error(`no Trading Window with ${MIN_LEFT_SEC}s left`);
  console.log("window", json({ id: BigInt(window.marketId).toString(), asset: window.asset, cadence: window.intervalSec, left: window.expirySec - nowSec }));
  const ctx = { journal: house.submitter.journal, wallet: house.address, contracts: house.contracts };

  // The boost: 2x on 10, sized by the chain off the live book at execution, guarded at 95% of the quoted size.
  let boostId: bigint | null = null;
  if (BOOST) {
  const quote = unwrap(await sizeLeverageForStake(window.marketId, "up", 10n * one, 20_000, lev.params.maintenanceBps));
  console.log("2x on 10 quoted", json({ contracts: quote.quantityRaw, price: quote.priceRaw, stake: quote.stakeBase, fronted: quote.frontedBase, premium: quote.premiumBase, win: quote.winIfRightBase, line: quote.lineBase }));
  const opened = expectStatus(
    "leverage open",
    await submitLeverageOpen(ctx, { kind: "leverage-open", marketId: window.marketId, side: "up", stakeBase: 10n * one, leverageBps: 20_000, minQuantityRaw: (quote.quantityRaw * 95n) / 100n }, lev.params.maintenanceBps),
    "confirmed",
  );
  if (opened.status !== "confirmed") throw new Error("unreachable");
  console.log("boost", json({ id: opened.positionId, stake: opened.stakeBase, contracts: opened.quantityRaw, fronted: opened.frontedBase, tx: opened.txHash, gas: gasOf(opened.txHash) }));
  console.log("mark", json(unwrap(await getLeverageMark(opened.positionId))));
  boostId = opened.positionId;
  }

  // The band: inside, 0.15% either side of the opening print, a 5 stake.
  const basis = unwrap(await previewRangeBasis(window.marketId, window.asset));
  const width = (basis.openingPrint * 15n) / 10_000n;
  const band = { marketId: window.marketId, asset: window.asset, side: "inside" as const, lowPrint: basis.openingPrint - width, highPrint: basis.openingPrint + width };
  const tauSec = Math.max(1, window.expirySec - Math.floor(marketsProvider.nowMs() / 1000));
  const rq = unwrap(await quoteRangeOnchain(band, { kind: "fixStake", stakeBase: 5n * one }, rng.params, tauSec));
  console.log("band quoted", json({ low: band.lowPrint, high: band.highPrint, stake: rq.stakeBase, payout: rq.maxPayoutBase, insideProbE6: rq.insideProbE6 }));
  // The basis drifts with every second left; the open carries the surfaces' headroom over the quote.
  const maxStake = mulBpsCeil(rq.stakeBase, 10_000 + RANGE_STAKE_HEADROOM_BPS);
  const ropen = expectStatus("range open", await submitRangeOpen(ctx, { kind: "range-open", ...band, maxPayoutBase: rq.maxPayoutBase, maxStakeBase: maxStake }), "confirmed");
  if (ropen.status !== "confirmed") throw new Error("unreachable");
  console.log("round", json({ id: ropen.roundId, stake: ropen.stakeBase, tx: ropen.txHash, gas: gasOf(ropen.txHash) }));

  if (WAIT) {
    const deadline = Date.now() + 30 * 60_000;
    for (;;) {
      const now = unwrap(await marketsProvider.getOnchain(window.marketId));
      if (now.isResolved || now.isVoided) break;
      if (Date.now() > deadline) throw new Error("the Window did not settle within 30 minutes");
      console.log(`waiting… status ${now.status}, ${Math.max(0, now.expirySec - Math.floor(marketsProvider.nowMs() / 1000))}s to expiry`);
      await new Promise((r) => setTimeout(r, 20_000));
    }
    if (boostId !== null) {
      const ls = expectStatus("leverage settle", await house.submitter.submitTx({ kind: "leverage-settle", positionId: boostId, marketId: window.marketId }), "confirmed");
      if (ls.status === "confirmed") console.log("leverage settle gas", gasOf(ls.txHash));
    }
    // The hub answers about two seconds after expiry; a settle before that reverts and is simply retried.
    let rs = await house.submitter.submitTx({ kind: "range-settle", roundId: ropen.roundId, marketId: window.marketId });
    for (let i = 0; i < 6 && rs.status !== "confirmed"; i++) {
      await new Promise((r) => setTimeout(r, 10_000));
      rs = await house.submitter.submitTx({ kind: "range-settle", roundId: ropen.roundId, marketId: window.marketId });
    }
    expectStatus("range settle", rs, "confirmed");
    if (rs.status === "confirmed") console.log("range settle gas", gasOf(rs.txHash));
    const round = unwrap(await listRangesOf(house.address)).find((r) => r.roundId === ropen.roundId);
    if (round?.status === "won") {
      const claim = expectStatus("range claim", await house.submitter.submitTx({ kind: "range-claim", roundId: ropen.roundId }), "confirmed");
      if (claim.status === "confirmed") console.log("range claim gas", gasOf(claim.txHash));
    }
  }

  const positions = unwrap(await listLeveragePositionsOf(house.address));
  console.log("boosts", json(positions.map((p) => ({ id: p.positionId, status: p.status, stake: p.stakeBase, fronted: p.frontedBase, returned: p.returnedBase }))));
  const rounds = unwrap(await listRangesOf(house.address));
  console.log("rounds", json(rounds.map((r) => ({ id: r.roundId, status: r.status, stake: r.stakeBase, payout: r.maxPayoutBase, closing: r.closingPrint }))));
  await house.dispose();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeRuntime();
  setTimeout(() => process.exit(process.exitCode ?? 0), 2_000).unref();
}
