import { execSync } from "node:child_process";

import type { ParlayLegInput } from "@masayume/core/parlay";
import { toMarketId, type Hex } from "@masayume/core/types";
import { oneUnit } from "@masayume/core/units";
import {
  closeRuntime,
  configureMarkets,
  createMemoryJournal,
  createSubmitterSession,
  getParlayReserveState,
  listParlaysOf,
  loadCollateral,
  marketsProvider,
  parseMarketsEnv,
  quoteParlayOnchain,
  submitParlayOpen,
  unwrap,
} from "@masayume/markets";

/**
 * Drives the parlay reserve through the REAL adapter against a local Anvil fork of Shannon (RESUME.md
 * §Stage 5): the house supplies → the opener quotes two legs off the chain → opens → the slip read →
 * warp + void → a permissionless crank → the refund → the house withdraws. Every step goes through the
 * port's own lanes.
 *
 * Env: RPC_HTTP_URLS / RPC_WS_URLS (the fork), PARLAY_RESERVE_ADDRESS, HOUSE_KEY, OPENER_KEY (funded fork
 * keys; OPENER_KEY defaults to HOUSE_KEY), FORK_MARKET_IDS (two comma-separated ids to pin; else the two
 * soonest Windows with four minutes left). LIVE=1 runs against the real network: no time travel — the
 * Windows settle by the oracle, the cranks wait for them, and a won ticket is claimed.
 */
const LIVE = process.env.LIVE === "1";
const RPC = process.env.RPC_HTTP_URLS ?? (LIVE ? undefined : "http://127.0.0.1:8546");
const json = (value: unknown) => JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);
const rpc = (method: string, ...params: string[]) => execSync(`cast rpc ${method} ${params.join(" ")} --rpc-url ${RPC}`, { encoding: "utf8" }).trim();
const call = (to: string, sig: string) => execSync(`cast call ${to} "${sig}" --rpc-url ${RPC}`, { encoding: "utf8" }).trim();

function marketIdOf(raw: string) {
  return toMarketId(raw.startsWith("0x") ? raw : `0x${BigInt(raw).toString(16).padStart(64, "0")}`);
}

async function pickWindows(): Promise<[ParlayLegInput, ParlayLegInput]> {
  const pinned = process.env.FORK_MARKET_IDS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (pinned?.length === 2) return [{ marketId: marketIdOf(pinned[0] as string), side: "up" }, { marketId: marketIdOf(pinned[1] as string), side: "down" }];
  const { resolveVenueId } = await import("@masayume/markets");
  const venue = unwrap(await resolveVenueId(env.venueId));
  if (!venue.venueId) throw new Error("no venue");
  const lanes = unwrap(await marketsProvider.listLiveLanes(venue.venueId));
  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  const picks = lanes.lanes
    .flatMap((lane) => lane.markets)
    .filter((m) => m.status === "Trading" && m.expirySec - nowSec >= 240)
    .sort((a, b) => a.expirySec - b.expirySec)
    .slice(0, 2);
  if (picks.length < 2) throw new Error("fewer than two Trading Windows with four minutes left");
  return [{ marketId: (picks[0] as (typeof picks)[number]).marketId, side: "up" }, { marketId: (picks[1] as (typeof picks)[number]).marketId, side: "down" }];
}

function expectStatus<T extends { status: string }>(label: string, outcome: T, ...ok: string[]): T {
  if (!ok.includes(outcome.status)) throw new Error(`${label}: ${json(outcome)}`);
  console.log(`${label}: ${outcome.status}`);
  return outcome;
}

const env = parseMarketsEnv({
  rpcHttpUrls: RPC,
  rpcWsUrls: process.env.RPC_WS_URLS ?? (LIVE ? undefined : "ws://127.0.0.1:8546"),
  venueId: process.env.VENUE_ID,
  parlayReserveAddress: process.env.PARLAY_RESERVE_ADDRESS,
  parlayReserveFromBlock: process.env.PARLAY_RESERVE_FROM_BLOCK ?? "0",
});
configureMarkets(env);

try {
  unwrap(await loadCollateral());
  await marketsProvider.syncClock();
  const state = unwrap(await getParlayReserveState());
  if (!state) throw new Error("ParlayReserve is not deployed on this network (set PARLAY_RESERVE_ADDRESS)");
  const one = oneUnit(state.decimals);
  console.log("reserve", json({ params: state.params, liquid: state.liquidBase, locked: state.lockedBase, paused: state.paused }));

  const house = await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: process.env.HOUSE_KEY as Hex }, journal: createMemoryJournal() });
  const openerKey = (process.env.OPENER_KEY ?? process.env.HOUSE_KEY) as Hex;
  const opener = openerKey === process.env.HOUSE_KEY ? house : await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: openerKey }, journal: createMemoryJournal() });
  console.log("house", house.address, "opener", opener.address);

  if (!process.env.SKIP_FAUCET) {
    expectStatus("house faucet", await house.submitter.submitTx({ kind: "faucet", amountBase: 10_000n * one }), "confirmed");
    if (opener !== house) expectStatus("opener faucet", await opener.submitter.submitTx({ kind: "faucet", amountBase: 1_000n * one }), "confirmed");
  }
  if (state.liquidBase < 1_000n * one) expectStatus("house supplies 5,000", await house.submitter.submitTx({ kind: "parlay-supply", amountBase: 5_000n * one }), "confirmed");

  const legs = await pickWindows();
  console.log("legs", json(legs));
  const quote = unwrap(await quoteParlayOnchain(legs, { kind: "fixStake", stakeBase: 5n * one }, state.params));
  console.log("quote for a 5.00 stake", json(quote));

  const opened = await submitParlayOpen({ journal: opener.submitter.journal, wallet: opener.address, contracts: opener.contracts }, { kind: "parlay-open", legs, maxPayoutBase: quote.maxPayoutBase, maxStakeBase: quote.stakeBase });
  expectStatus("open", opened, "confirmed");
  if (opened.status !== "confirmed") throw new Error("unreachable");
  console.log("ticket", opened.parlayId.toString(), "charged", opened.stakeBase.toString(), "tx", opened.txHash);

  const before = unwrap(await listParlaysOf(opener.address));
  console.log("slip", json(before.map((t) => ({ id: t.parlayId, status: t.status, stake: t.stakeBase, payout: t.maxPayoutBase, legs: t.legs.map((l) => `${l.side}@${l.priceRaw} ${l.status}`) }))));

  const onchain = await Promise.all(legs.map((leg) => marketsProvider.getOnchain(leg.marketId).then(unwrap)));
  if (LIVE) {
    // The oracle settles each Window after expiry; crank each leg as it settles, then claim if the streak landed.
    const deadline = Date.now() + 20 * 60_000;
    for (const [i, leg] of legs.entries()) {
      for (;;) {
        const now = unwrap(await marketsProvider.getOnchain(leg.marketId));
        if (now.isResolved || now.isVoided) break;
        if (Date.now() > deadline) throw new Error("a Window did not settle within 20 minutes");
        console.log(`waiting for leg ${i}… status ${now.status}, ${Math.max(0, now.expirySec - Math.floor(marketsProvider.nowMs() / 1000))}s to expiry`);
        await new Promise((r) => setTimeout(r, 20_000));
      }
      expectStatus(`crank leg ${i}`, await house.submitter.submitTx({ kind: "parlay-resolve-leg", parlayId: opened.parlayId, legIdx: i, marketId: leg.marketId }), "confirmed");
      const ticket = unwrap(await listParlaysOf(opener.address)).find((t) => t.parlayId === opened.parlayId);
      console.log(`after leg ${i}`, ticket?.status, ticket?.legs.map((l) => l.status));
      if (ticket && ticket.status !== "live") break;
    }
    const final = unwrap(await listParlaysOf(opener.address)).find((t) => t.parlayId === opened.parlayId);
    if (final?.status === "won") expectStatus("claim by the house, paid to the opener", await house.submitter.submitTx({ kind: "parlay-claim", parlayId: opened.parlayId }), "confirmed");
  } else {
    // On a fork: past both settlement windows with no oracle answer, anyone voids; the first void leg voids the ticket.
    const settlementWindow = Math.max(...onchain.map((o) => Number(call(o.marketAddress, "settlementWindow()(uint64)").split(" ")[0])));
    const last = Math.max(...onchain.map((o) => o.expirySec));
    rpc("evm_setNextBlockTimestamp", String(last + settlementWindow + 5));
    rpc("evm_mine");
    execSync(`cast send ${onchain[0]?.marketAddress} "voidExpired()" --private-key ${openerKey} --rpc-url ${RPC}`, { stdio: "ignore" });
    console.log("voided leg 0:", call(onchain[0]?.marketAddress as string, "isVoided()(bool)"));
    expectStatus("crank leg 0 by the house", await house.submitter.submitTx({ kind: "parlay-resolve-leg", parlayId: opened.parlayId, legIdx: 0, marketId: legs[0].marketId }), "confirmed");
  }

  const after = unwrap(await listParlaysOf(opener.address)).find((t) => t.parlayId === opened.parlayId);
  console.log("ticket after settlement", json({ status: after?.status, legs: after?.legs.map((l) => l.status), stake: after?.stakeBase, payout: after?.maxPayoutBase }));
  const sheet = unwrap(await marketsProvider.getBalanceSheet(opener.address));
  console.log("opener spendable", sheet.spendableBase.toString());
  const endState = unwrap(await getParlayReserveState());
  console.log("reserve after", json({ liquid: endState?.liquidBase, locked: endState?.lockedBase, utilizationBps: endState?.utilizationBps }));
  await house.dispose();
  if (opener !== house) await opener.dispose();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeRuntime();
  setTimeout(() => process.exit(process.exitCode ?? 0), 2_000).unref();
}

