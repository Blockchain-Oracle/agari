// The first-call drive on a Surfpool devnet fork (first-call.md §7 lane 4b proofs). The drive opens its own drive-only
// TEST-ATT-5m Window (attested prints, so it runs at any hour), seeds a maker, then drives every order and redeem
// outcome through the real lanes. Races are made deterministic with RPC hooks at the lane's two race points.

import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { chainReconcilerWith, indexEvidence, recoverUnresolved, solana } from "@agari/markets";
import {
  chainNowSec, DRIVE_ATTESTED_FEED, KIND, keypairSigner, openWindow, ORDER_TYPE, placeOrder, recordAttestedPrint, recycleBooks, settleWindow,
  WHICH, type OpenedWindow,
} from "@agari/markets/deploy";
import { createOpsClient, fetchMarkets, sendOps } from "@agari/markets/ops";
import { readLedger, readVenueConfig, redeemForInstructions } from "@agari/markets/ops/settle";
import type { EventMarket } from "@agari/core";
import { timeTravel } from "./sources";
import { check, costOf, holdings, hookedRpc, openDrive, phases, quoteNow, saveEvidence, sleep, userSession, type Drive, type User } from "./first-call-kit";

const CADENCE_SEC = 300;
const OPEN_PRICE_E8 = 36_500_000_000n;
const CLOSE_PRICE_E8 = 36_612_000_000n;
const TUSDC = 1_000_000n;

function eventMarket(d: Drive, w: OpenedWindow): EventMarket {
  return {
    marketId: w.market, venueId: d.config, asset: "TSLA", lane: "regular", question: "drive Window", intervalSec: CADENCE_SEC,
    tradingStartSec: w.tradingStartSec, lockAtSec: w.expirySec, expirySec: w.expirySec, poolAddress: w.book, marketAddress: w.market,
    seriesAddress: w.series, nonce: w.index, policyVersion: w.policyVersion, printSource: "attested", collateral: d.mint, decimals: 6,
    status: "Trading", winningOutcome: null, voided: false, voidReason: null, finalized: false, openingPriceRaw: null, volumeQuoteRaw: 0n,
    tradeCount: 0, lastPriceRaw: null, resolvedAtMs: null,
  } as unknown as EventMarket;
}

/** Surfpool's clock to `tSec` (forward only), then the session clock re-synced to it. */
async function travel(d: Drive, tSec: number) {
  const now = await chainNowSec(d.client);
  if (now < tSec) await timeTravel(d.rpcUrl, tSec);
  await d.clock.sync();
}

async function attest(d: Drive, w: OpenedWindow, which: number, boundaryTs: number, price: bigint) {
  const attestor = await keypairSigner(d.secretOf("price-attestor"));
  const fetchedAtTs = await chainNowSec(d.client);
  await recordAttestedPrint(d.ctx, w, { attestor, clusterTag: d.clusterTag, which, boundaryTs, price, feedId: DRIVE_ATTESTED_FEED, barLenSec: 60, fetchedAtTs });
}

/** A competitor's IOC that takes `lots` at up to `priceTicks`: the other side of every race below. */
const take = (d: Drive, w: OpenedWindow, who: User, kind: number, priceTicks: number, lots: bigint) =>
  placeOrder(d.ctx, w, who.signer, who.token as never, { kind, priceTicks, lots, orderType: ORDER_TYPE.ioc });

export async function forkDrive(d: Drive) {
  const journalPath = `${d.scratch}/first-call-journal.json`;
  rmSync(journalPath, { force: true });
  const maker = await d.newUser("maker", 50_000_000n, 30n * TUSDC);
  const user = await d.newUser("user", 50_000_000n, 10n * TUSDC);
  const rival = await d.newUser("rival", 50_000_000n, 10n * TUSDC);
  console.log(`  users: maker ${maker.address}, user ${user.address}, rival ${rival.address}`);

  // A fresh Window on the 5-minute grid, its opening print attested once T + min_delay (10 s) has passed.
  const tSec = Math.ceil((await chainNowSec(d.client)) / CADENCE_SEC) * CADENCE_SEC;
  await travel(d, tSec + 11);
  const series = d.venue.series!["TEST-ATT-5m"]!;
  await recycleBooks(d.ctx, series.address as never, series.books as never);
  const w = await openWindow(d.ctx, { roller: await keypairSigner(d.secretOf("roller")), series: series.address as never, mint: d.mint, tradingStartSec: tSec });
  await attest(d, w, WHICH.open, tSec, OPEN_PRICE_E8);
  const market = eventMarket(d, w);
  const hold = (who: User) => holdings(w.ledger, d.mint, who.address);

  // The seed maker: asks (BUY_NO) at 400 and 700, a bid (BUY_YES) at 350 (Down pays 650), all resting to the lock.
  await placeOrder(d.ctx, w, maker.signer, maker.token as never, { kind: KIND.buyNo, priceTicks: 400, lots: 5_000n, orderType: ORDER_TYPE.normal });
  await placeOrder(d.ctx, w, maker.signer, maker.token as never, { kind: KIND.buyNo, priceTicks: 700, lots: 3_000n, orderType: ORDER_TYPE.normal });
  await placeOrder(d.ctx, w, maker.signer, maker.token as never, { kind: KIND.buyYes, priceTicks: 350, lots: 10_000n, orderType: ORDER_TYPE.normal });
  const session = await userSession(d, user, journalPath);
  const order = (side: "up" | "down", stakeBase: bigint, displayedQuote: Awaited<ReturnType<typeof quoteNow>>) => ({ market, side, stakeBase, displayedQuote, wallet: user.address as never });
  const results: Record<string, unknown> = { window: w };

  // A. Up: an IOC BUY_YES through the lane, booked from OrderExecuted.
  console.log("A. Up fill");
  let before = await hold(user);
  const qa = await quoteNow(d, market, "up", 2n * TUSDC);
  const a = await session.submitter.submitOrder(order("up", 2n * TUSDC, qa), phases("A"));
  check(a.status === "confirmed", `A confirmed (got ${a.status}${"diagnosis" in a ? `: ${a.diagnosis.technical}` : ""})`);
  let after = await hold(user);
  check(a.booked.contractsRaw === qa.contractsRaw && a.booked.costBase === qa.expectedCostBase, `A booked ${a.booked.contractsRaw} raw for ${a.booked.costBase} = quote`);
  check(after.seat!.yesFree * 1000n === a.booked.contractsRaw, `A seat yes_free ${after.seat!.yesFree} lots`);
  check(before.tokenBase - after.tokenBase === a.booked.costBase + 250_000n, `A paid ${before.tokenBase - after.tokenBase} = cost + 0.25 bond`);
  const costA = await costOf(a.booked.txHash);
  results.A = { booked: a.booked, cost: costA };
  d.log({ step: "A up fill", signature: a.booked.txHash, note: `${a.booked.contractsRaw} raw @ ${a.booked.avgPriceBps} bps, ${costA.computeUnits} CU, ${costA.bytes} B` });

  // B. Down: an IOC BUY_NO into the maker's bid; the seat exists now, so no bond.
  console.log("B. Down fill");
  before = after;
  const qb = await quoteNow(d, market, "down", TUSDC);
  const b = await session.submitter.submitOrder(order("down", TUSDC, qb), phases("B"));
  check(b.status === "confirmed", `B confirmed (got ${b.status})`);
  after = await hold(user);
  check(b.booked.costBase === qb.expectedCostBase && b.booked.avgPriceBps === 6_500, `B booked ${b.booked.contractsRaw} raw for ${b.booked.costBase} at 6,500 bps own terms`);
  check(before.tokenBase - after.tokenBase === b.booked.costBase && after.seat!.noFree * 1000n === b.booked.contractsRaw, "B paid cost only (no second bond), seat no_free matches");
  const costB = await costOf(b.booked.txHash);
  results.B = { booked: b.booked, cost: costB };
  d.log({ step: "B down fill", signature: b.booked.txHash, note: `${b.booked.contractsRaw} raw for ${b.booked.costBase}, ${costB.computeUnits} CU, ${costB.bytes} B` });

  // C. The rival empties the 400 ask between quote and simulation: 6110 in simulation → requote at 700 → accepted → fill.
  console.log("C. simulation 6110 → requote");
  const qc = await quoteNow(d, market, "up", TUSDC);
  const remaining400 = 5_000n - qa.contractsRaw / 1000n;
  const raced = hookedRpc({ beforeSimulate: async () => void (await take(d, w, rival, KIND.buyYes, 400, remaining400)) });
  const c = await (await userSession(d, user, journalPath, raced.rpc)).submitter.submitOrder(order("up", TUSDC, qc), phases("C"));
  check(c.status === "requote", `C requote (got ${c.status}${"diagnosis" in c ? `: ${c.diagnosis.technical}` : ""})`);
  check(raced.counts.send === 0 && c.quote.limitPriceRaw > qc.limitPriceRaw, `C nothing sent; fresh limit ${c.quote.limitPriceRaw} > confirmed ${qc.limitPriceRaw}`);
  const c2 = await session.submitter.submitOrder(order("up", TUSDC, c.quote), phases("C'"));
  check(c2.status === "confirmed" && c2.booked.avgPriceBps === 7_000, `C' requote accepted and filled at 7,000 bps`);
  results.C = { requote: c.quote, booked: c2.booked };
  d.log({ step: "C requote fill", signature: c2.booked.txHash, note: `${c2.booked.contractsRaw} raw for ${c2.booked.costBase}` });

  // D. The rival empties every ask between signing and landing (preflight skipped, as when the race is lost after it).
  console.log("D. landed nothingFilled");
  before = await hold(user);
  const qd = await quoteNow(d, market, "up", TUSDC);
  const remaining700 = 3_000n - c2.booked.contractsRaw / 1000n;
  const lost = hookedRpc({ beforeFirstSend: async () => void (await take(d, w, rival, KIND.buyYes, 700, remaining700)), skipFirstPreflight: true });
  const dd = await (await userSession(d, user, journalPath, lost.rpc)).submitter.submitOrder(order("up", TUSDC, qd), phases("D"));
  check(dd.status === "nothingFilled", `D nothingFilled (got ${dd.status}${"diagnosis" in dd ? `: ${dd.diagnosis.technical}` : ""})`);
  after = await hold(user);
  check(after.seat!.yesFree === before.seat!.yesFree && after.tokenBase === before.tokenBase, "D stake untouched: seat and tUSDC unchanged");
  const landed = await solana().rpc.getSignatureStatuses([dd.txHash as never], { searchTransactionHistory: true }).send();
  check(landed.value[0]?.err != null, `D landed with err ${JSON.stringify(landed.value[0]?.err, (_k, v) => (typeof v === "bigint" ? Number(v) : v))}`);
  results.D = { txHash: dd.txHash };
  d.log({ step: "D nothing filled", signature: dd.txHash, note: "IOC landed with 6110, fee paid, stake untouched" });

  // E. A send killed mid-flight: a child process journals, sends and is SIGKILLed; this process reconciles by signature.
  console.log("E. killed send → reconcile by signature");
  before = await hold(user);
  const qe = await quoteNow(d, market, "down", TUSDC);
  const statePath = `${d.scratch}/first-call-child.json`;
  writeFileSync(statePath, JSON.stringify({ rpcUrl: d.rpcUrl, wsUrl: d.wsUrl, journalPath, market, secret: [...user.secret], stake: String(TUSDC) }, (_k, v) => (typeof v === "bigint" ? `${v}n` : v)), { mode: 0o600 });
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, "--child", "killed-send", "--state", statePath], { stdio: "inherit" });
  const signal = await new Promise<string | null>((resolve) => child.on("exit", (_code, sig) => resolve(sig)));
  rmSync(statePath, { force: true });
  check(signal === "SIGKILL", `E child killed after its first send (${signal})`);
  const journal = (await userSession(d, user, journalPath)).submitter.journal;
  const open = await journal.listUnresolved(user.address as never);
  check(open.length === 1 && open[0]!.state === "sent" && !!open[0]!.txHash && open[0]!.lastValidBlockHeight !== undefined, `E journal holds one sent record with signature and lastValidBlockHeight`);
  const counting = hookedRpc();
  const recovered = await recoverUnresolved(journal, user.address as never, chainReconcilerWith({ rpc: counting.rpc, evidence: indexEvidence(undefined, counting.rpc), nowMs: Date.now }), Date.now());
  check(recovered.length === 1 && recovered[0]!.outcome === "landed", `E reconciled: ${recovered[0]?.outcome}`);
  check(counting.counts.send === 0 && counting.counts.simulate === 0, "E nothing re-simulated or re-sent during recovery");
  after = await hold(user);
  check((after.seat!.noFree - before.seat!.noFree) * 1000n === qe.contractsRaw, `E filled exactly once: +${after.seat!.noFree - before.seat!.noFree} NO lots`);
  check((await journal.listUnresolved(user.address as never)).length === 0, "E journal has nothing unresolved");
  results.E = { txHash: open[0]!.txHash, lastValidBlockHeight: open[0]!.lastValidBlockHeight };
  d.log({ step: "E killed send", signature: open[0]!.txHash!, note: "journaled, SIGKILLed, reconciled confirmed by signature" });

  // Settle: the close print at T + 300, then single-source settle once the missing check's admission (120 s) has passed.
  console.log("settle");
  await travel(d, w.expirySec + 11);
  await attest(d, w, WHICH.close, w.expirySec, CLOSE_PRICE_E8);
  await travel(d, w.expirySec + 125);
  await settleWindow(d.ctx, w);

  // Redeem: the user's own claim through the lane, paid to the base unit.
  console.log("redeem");
  before = await hold(user);
  const seat = before.seat!;
  const expected = seat.yesFree * 1000n + seat.credit + seat.lockedCash + 250_000n;
  const r = await session.submitter.submitTx({ kind: "redeem", marketId: market.marketId, outcomeIdx: 0, amountRaw: 0n }, phases("redeem"));
  check(r.status === "confirmed", `redeem confirmed (got ${r.status}${"diagnosis" in r ? `: ${r.diagnosis.technical}` : ""})`);
  after = await hold(user);
  check(after.tokenBase - before.tokenBase === expected && after.seat === null, `redeem paid ${after.tokenBase - before.tokenBase} = ${expected}; seat cleared`);
  const costR = await costOf(r.txHash);
  results.redeem = { txHash: r.txHash, paid: after.tokenBase - before.tokenBase, cost: costR };
  d.log({ step: "redeem", signature: r.txHash, note: `paid ${expected}, ${costR.computeUnits} CU, ${costR.bytes} B` });

  // Crank-paid: the settler pays the rival's seat with redeem_for; the rival's claim reconciles to that signature.
  console.log("crank-paid reconcile");
  const settler = await createOpsClient({ rpcUrl: d.rpcUrl, rpcSubscriptionsUrl: d.wsUrl, payerSecret: d.secretOf("settler") });
  const [view] = await fetchMarkets(settler, [w.market]);
  const rivalSeat = (await readLedger(settler, w.ledger))!.seats.find((s) => s.owner === rival.address)!;
  const crank = await sendOps(settler, await redeemForInstructions(settler, view!, await readVenueConfig(settler), rivalSeat), "redeem_for");
  const rr = await (await userSession(d, rival, `${d.scratch}/first-call-rival-journal.json`)).submitter.submitTx({ kind: "redeem", marketId: market.marketId, outcomeIdx: 0, amountRaw: 0n }, phases("rival"));
  check(rr.status === "confirmed" && rr.txHash === crank.signature, `rival's claim reconciled to the crank ${crank.signature}`);
  results.crank = { txHash: crank.signature };
  d.log({ step: "crank-paid", signature: crank.signature, note: "rival's redeem reconciled to redeem_for (no transaction sent)" });
  rmSync(`${d.scratch}/first-call-rival-journal.json`, { force: true });
  saveEvidence(d, results);
}

/** Process 2 of proof E: place the order and die the moment its bytes are sent, before any confirmation. */
export async function killedSendChild(statePath: string) {
  const state = JSON.parse(readFileSync(statePath, "utf8"), (_k, v) => (typeof v === "string" && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v));
  const d = await openDrive({ cluster: "localnet", rpcUrl: state.rpcUrl, wsUrl: state.wsUrl, scratch: "" });
  const user = { label: "user", secret: Uint8Array.from(state.secret), address: "", signer: await keypairSigner(Uint8Array.from(state.secret)), token: "" };
  const killer = hookedRpc({ afterFirstSend: () => process.kill(process.pid, "SIGKILL") });
  const session = await userSession(d, user as User, state.journalPath, killer.rpc);
  const quote = await quoteNow(d, state.market, "down", BigInt(state.stake));
  await session.submitter.submitOrder({ market: state.market, side: "down", stakeBase: BigInt(state.stake), displayedQuote: quote, wallet: session.address }, phases("E child"));
  await sleep(60_000);
  throw new Error("the child was not killed after its send");
}
