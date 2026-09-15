// The vault drive on a Surfpool devnet fork (tap-trading.md §6 lane 7b proofs; stage-07 Gate): agari-vault deployed
// into the fork only, registered at program_authorities[0], then a drive-opened TEST-ATT-5m Window where a session
// key taps through the vault with the sponsor as fee payer, a cap refusal sends nothing, both routes cash out, a tap
// killed mid-send reconciles by signature, the owner revokes, a stranger cranks the settled slot, the Ledger closes,
// and the owner withdraws.

import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { chainReconcilerWith, generateSessionKey, indexEvidence, marketsProvider, recoverUnresolved, syncClock, type SessionKey } from "@agari/markets";
import { chainNowSec, initVault, KIND, keypairSigner, openWindow, ORDER_TYPE, placeOrder, recordAttestedPrint, recycleBooks, registerVaultSeat, settleWindow, DRIVE_ATTESTED_FEED, WHICH } from "@agari/markets/deploy";
import { createOpsClient, fetchMarkets, sendOps } from "@agari/markets/ops";
import { closeLedgerInstruction, isProgramSeat, planVaultCranks, readLedger, readVenueConfig, redeemForInstructions, sweepInstruction } from "@agari/markets/ops/settle";
import type { CashOutOutcome, EventMarket, OrderOutcome, TxOutcome } from "@agari/core";
import { timeTravel } from "./sources";
import { check, hookedRpc, openDrive, phases, quoteNow, sleep, type Drive, type User } from "./first-call-kit";
import { countingSponsor, keySession, lamports, onchainOf, ownerSession, pointAtVault, saveFixture, signersOf, tokenOf, TUSDC, vaultHeld, vaultState, walletHeld } from "./vault-kit";

const CADENCE_SEC = 300;
const OPEN_E8 = 36_500_000_000n;
const CLOSE_E8 = 36_700_000_000n;
const why = (o: OrderOutcome | TxOutcome | CashOutOutcome) => `${o.status}${"diagnosis" in o ? `: ${o.diagnosis.technical}` : ""}`;

function eventMarket(d: Drive, w: Awaited<ReturnType<typeof openWindow>>): EventMarket {
  return {
    marketId: w.market, venueId: d.config, asset: "TSLA", lane: "regular", question: "vault drive Window", intervalSec: CADENCE_SEC, tradingStartSec: w.tradingStartSec,
    lockAtSec: w.expirySec, expirySec: w.expirySec, poolAddress: w.book, marketAddress: w.market, seriesAddress: w.series, nonce: w.index, policyVersion: w.policyVersion,
    printSource: "attested", collateral: d.mint, decimals: 6, status: "Trading", winningOutcome: null, voided: false, voidReason: null, finalized: false,
    openingPriceRaw: null, volumeQuoteRaw: 0n, tradeCount: 0, lastPriceRaw: null, resolvedAtMs: null,
  } as unknown as EventMarket;
}

async function travel(d: Drive, tSec: number) {
  if ((await chainNowSec(d.client)) < tSec) await timeTravel(d.rpcUrl, tSec);
  await Promise.all([d.clock.sync(), syncClock()]);
}

async function attest(d: Drive, w: Awaited<ReturnType<typeof openWindow>>, which: number, boundaryTs: number, price: bigint) {
  const attestor = await keypairSigner(d.secretOf("price-attestor"));
  await recordAttestedPrint(d.ctx, w, { attestor, clusterTag: d.clusterTag, which, boundaryTs, price, feedId: DRIVE_ATTESTED_FEED, barLenSec: 60, fetchedAtTs: await chainNowSec(d.client) });
}

export async function vaultForkDrive(d: Drive, fixturesDir: string) {
  const results: Record<string, unknown> = {};
  console.log("setup: init vault, register the seat");
  await initVault(d.ctx);
  await registerVaultSeat(d.ctx);
  const deployment = await pointAtVault(d);
  check(deployment.seat === "H767WASSs2TXBBYwcVunaN2kfFbQ8CWTLWdZB9nP8k8", `vault deployed and confirmed: seat ${deployment.seat}, from slot ${deployment.fromBlock}`);

  const owner = await d.newUser("owner", 100_000_000n, 60n * TUSDC);
  const maker = await d.newUser("maker", 100_000_000n, 80n * TUSDC);
  const cranker = await d.newUser("cranker", 20_000_000n, TUSDC);
  const sponsor = await countingSponsor(d);
  const key: SessionKey = await generateSessionKey();
  const journal = (name: string) => `${d.scratch}/vault-${name}-journal.json`;
  const ownerSponsored = await ownerSession(d, owner, journal("owner"), sponsor.cosigner);
  console.log(`  owner ${owner.address}, maker ${maker.address}, session key ${key.address} (0 SOL), sponsor ${sponsor.address}`);

  // A. Enable: open + deposit + grant in ONE owner signature; the key holds no SOL because the sponsor pays its taps.
  console.log("A. enable tap trading (one signature)");
  const nowSec = Math.floor(d.clock.nowMs() / 1000);
  const caps = { maxStakePerTradeBase: 5n * TUSDC, maxDailySpendBase: 25n * TUSDC, maxOpenPositions: 4, maxPriceRaw: 950_000n };
  const tokenBefore = await tokenOf(owner.address, d.mint);
  const enable = await ownerSponsored.submitter.submitTx({ kind: "vault-deposit-and-grant", amountBase: 40n * TUSDC, terms: { kind: "session", actor: key.address, caps, expiresAtSec: nowSec + 86_400, budgetBase: 25n * TUSDC } }, phases("A"));
  check(enable.status === "confirmed", `A confirmed (${why(enable)})`);
  const enableTx = await signersOf(enable.txHash);
  check(enableTx.signers.length === 1 && enableTx.feePayer === owner.address, `A one signature, fee payer = owner (${enableTx.signers.length} signer)`);
  let state = await vaultState(owner.address);
  const tokenAfter = await tokenOf(owner.address, d.mint);
  check(state.available === 15n * TUSDC && state.session?.budgetBase === 25n * TUSDC && state.session.actor === key.address && tokenBefore - tokenAfter === 40n * TUSDC, `A Trading Balance 15 tUSDC, session grant #${state.session?.grantId} budget 25 → key, wallet −40 tUSDC`);
  const grantId = state.session!.grantId;
  results.enable = { txHash: enable.txHash, grantId, computeUnits: enableTx.computeUnits };
  d.log({ step: "A enable", signature: enable.txHash, note: `open+deposit 40 tUSDC+grant #${grantId} budget 25, 1 signature, ${enableTx.computeUnits} CU` });

  // An EXECUTOR grant for proof F's throwaway actor, from the Trading Balance (no Window needed).
  const actor = await d.newUser("actor", 10_000_000n, TUSDC);
  const exec = await (await ownerSession(d, owner, journal("owner"))).submitter.submitTx({ kind: "vault-grant", terms: { kind: "executor", actor: actor.address as never, caps, expiresAtSec: nowSec + 86_400, budgetBase: 5n * TUSDC } }, phases("F grant"));
  check(exec.status === "confirmed", `F executor grant (${why(exec)})`);
  const execGrantId = (await vaultState(owner.address)).executor!.grantId;

  // The Window: opened after registration, so seat 0 is the vault's PROGRAM seat.
  const tSec = Math.ceil((await chainNowSec(d.client)) / CADENCE_SEC) * CADENCE_SEC;
  await travel(d, tSec + 11);
  const series = d.venue.series!["TEST-ATT-5m"]!;
  await recycleBooks(d.ctx, series.address as never, series.books as never);
  const w = await openWindow(d.ctx, { roller: await keypairSigner(d.secretOf("roller")), series: series.address as never, mint: d.mint, tradingStartSec: tSec });
  await attest(d, w, WHICH.open, tSec, OPEN_E8);
  const market = eventMarket(d, w);
  const vaultSeat = (await readLedger(d.client, w.ledger))!.seats.find((s) => String(s.owner) === String(deployment.seat));
  check(vaultSeat?.index === 0 && isProgramSeat(vaultSeat), `Window ${w.market}: seat 0 is the vault's PROGRAM seat`);
  // The seed maker: an ask at 550 (Up pays 55¢) and a bid at 400 (Down pays 60¢). Both sides must stay under the
  // grant's 95¢ price cap once `quote_stake` pads the protective limit by the 5-minute cost-cap buffer (5,661 bps).
  await placeOrder(d.ctx, w, maker.signer, maker.token as never, { kind: KIND.buyNo, priceTicks: 550, lots: 30_000n, orderType: ORDER_TYPE.normal });
  await placeOrder(d.ctx, w, maker.signer, maker.token as never, { kind: KIND.buyYes, priceTicks: 400, lots: 30_000n, orderType: ORDER_TYPE.normal });

  // B. Three taps: signer = session key, fee payer = sponsor, zero owner signatures; the key's SOL never moves.
  console.log("B. three sponsored session-key taps");
  const counted = hookedRpc();
  const keyed = await keySession(d, key, journal("key"), sponsor.cosigner, counted.rpc);
  const tap = async (label: string, side: "up" | "down", stake: bigint) => {
    const quote = await quoteNow(d, market, side, stake);
    return keyed.submitter.submitOrder({ market, side, stakeBase: stake, displayedQuote: quote, wallet: key.address, route: { kind: "vault-grant", grantId } }, phases(label));
  };
  const taps: unknown[] = [];
  for (const [label, side] of [["B1", "up"], ["B2", "up"], ["B3", "down"]] as const) {
    const o = await tap(label, side, TUSDC);
    check(o.status === "confirmed", `${label} confirmed (${why(o)})`);
    const tx = await signersOf(o.booked.txHash);
    check(tx.feePayer === sponsor.address && tx.signers.length === 2 && tx.signers[1] === key.address, `${label} fee payer = sponsor, signer = session key; ${o.booked.contractsRaw} raw for ${o.booked.costBase} at ${o.booked.avgPriceBps} bps`);
    taps.push({ label, txHash: o.booked.txHash, booked: o.booked, fee: tx.fee, computeUnits: tx.computeUnits });
    d.log({ step: `${label} tap ${side}`, signature: o.booked.txHash, note: `${o.booked.contractsRaw} raw for ${o.booked.costBase}, sponsor paid ${tx.fee} lamports, ${tx.computeUnits} CU` });
    if (label === "B1") await saveFixture(o.booked.txHash, `${fixturesDir}/vault-tap-sponsored.json`, "Surfpool devnet fork: a session-key actor_place_for co-signed by the sponsor (S7b drive)");
  }
  check((await lamports(key.address)) === 0n && sponsor.calls() === 3, "B the key still holds 0 SOL; three co-sign requests");
  results.taps = taps;
  let onchain = await onchainOf(w.market);
  let held = await vaultHeld(owner.address, onchain);
  check(held.upGrantId === grantId && held.downGrantId === grantId, `B vault holds ${held.upRaw} Up and ${held.downRaw} Down raw for the owner, both opened by grant #${grantId}`);

  // C. A tap over the per-trade cap is refused before any simulation, send or co-sign request.
  console.log("C. cap refusal");
  const before = { ...counted.counts, cosign: sponsor.calls() };
  const refused = await tap("C", "up", 9n * TUSDC);
  check(refused.status === "refused" && refused.diagnosis.errorName === "OverStakeCap", `C refused ${refused.status === "refused" ? `${refused.diagnosis.kind} ${refused.diagnosis.errorName}: ${refused.diagnosis.technical}` : refused.status}`);
  check(counted.counts.simulate === before.simulate && counted.counts.send === before.send && sponsor.calls() === before.cosign, "C no simulation, no transaction, no co-sign request");
  results.capRefusal = { diagnosis: refused.status === "refused" ? refused.diagnosis : null };

  // D. Vault cash-out through the grant: SELL_YES into the 350 bid, sponsored; proceeds land on the Trading Balance.
  console.log("D. vault cash-out (grant route)");
  const availableBefore = (await vaultState(owner.address)).available;
  const exitD = await marketsProvider.freshExitQuote(market, "up", held.upRaw / 2n);
  check(exitD.ok && exitD.value !== null, `D exit quote (${exitD.ok ? `${exitD.value === null ? "no liquidity" : `${exitD.value.contractsRaw} raw for at least ${exitD.value.minProceedsBase}`}` : exitD.error.technical})`);
  const soldD = await keyed.submitter.submitCashOut({ market, side: "up", contractsRaw: exitD.value.contractsRaw, displayedExit: exitD.value, wallet: key.address, route: { kind: "vault-grant", grantId } }, phases("D"));
  check(soldD.status === "confirmed", `D confirmed (${why(soldD)})`);
  const gained = (await vaultState(owner.address)).available - availableBefore;
  check(gained === soldD.booked.proceedsBase && soldD.booked.costBase === 0n && gained >= exitD.value.minProceedsBase, `D sold ${soldD.booked.contractsRaw} raw for ${gained} (floor ${exitD.value.minProceedsBase}) into the Trading Balance`);
  results.vaultCashOut = { txHash: soldD.booked.txHash, booked: soldD.booked };
  d.log({ step: "D vault cash-out", signature: soldD.booked.txHash, note: `${soldD.booked.contractsRaw} raw → +${gained} Trading Balance, sponsored` });

  // E. Plain cash-out on the wallet route (L-35): a wallet IOC buy, then an IOC sell whose proceeds land in the ATA.
  console.log("E. wallet plain cash-out");
  const wallet = await ownerSession(d, owner, journal("owner"));
  const qe = await quoteNow(d, market, "up", 2n * TUSDC);
  const bought = await wallet.submitter.submitOrder({ market, side: "up", stakeBase: 2n * TUSDC, displayedQuote: qe, wallet: owner.address as never }, phases("E buy"));
  check(bought.status === "confirmed", `E buy (${why(bought)})`);
  const exitE = await marketsProvider.freshExitQuote(market, "up", bought.booked.contractsRaw);
  check(exitE.ok && exitE.value !== null, `E exit quote (${exitE.ok ? `${exitE.value === null ? "no liquidity" : `${exitE.value.contractsRaw} raw`}` : exitE.error.technical})`);
  const tokenE = (await walletHeld(w.ledger, d.mint, owner.address)).tokenBase;
  const soldE = await wallet.submitter.submitCashOut({ market, side: "up", contractsRaw: exitE.value.contractsRaw, displayedExit: exitE.value, wallet: owner.address as never }, phases("E sell"));
  check(soldE.status === "confirmed", `E sell (${why(soldE)})`);
  const afterE = await walletHeld(w.ledger, d.mint, owner.address);
  check(afterE.tokenBase - tokenE === soldE.booked.proceedsBase && soldE.booked.contractsRaw === exitE.value.contractsRaw, `E sold ${soldE.booked.contractsRaw} raw, ATA +${afterE.tokenBase - tokenE} = proceeds`);
  results.walletCashOut = { buy: bought.booked.txHash, sell: soldE.booked.txHash, booked: soldE.booked };
  d.log({ step: "E wallet cash-out", signature: soldE.booked.txHash, note: `IOC SELL_YES ${soldE.booked.contractsRaw} raw → ATA +${soldE.booked.proceedsBase}` });

  // F. A tap killed right after its first send (after the co-sign returned) reconciles by signature; nothing re-signed.
  console.log("F. killed co-signed tap → reconcile by signature");
  const heldF = (await vaultHeld(owner.address, await onchainOf(w.market))).downRaw;
  const statePath = `${d.scratch}/vault-child.json`;
  writeFileSync(statePath, JSON.stringify({ rpcUrl: d.rpcUrl, wsUrl: d.wsUrl, journalPath: journal("actor"), market, secret: [...actor.secret], grantId: String(execGrantId) }, (_k, v) => (typeof v === "bigint" ? `${v}n` : v)), { mode: 0o600 });
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, "--child", "killed-tap", "--state", statePath], { stdio: "inherit" });
  const signal = await new Promise<string | null>((resolve) => child.on("exit", (_code, sig) => resolve(sig)));
  rmSync(statePath, { force: true });
  check(signal === "SIGKILL", `F child killed after its first send (${signal})`);
  await sleep(3_000);
  const actorJournal = (await ownerSession(d, actor, journal("actor"))).submitter.journal;
  const open = await actorJournal.listUnresolved(actor.address as never);
  check(open.length === 1 && open[0]!.state === "sent" && !!open[0]!.txHash, "F journal holds one sent record with its signature");
  const counting = hookedRpc();
  const recovered = await recoverUnresolved(actorJournal, actor.address as never, chainReconcilerWith({ rpc: counting.rpc, evidence: indexEvidence(counting.rpc), nowMs: Date.now }), Date.now());
  check(recovered[0]?.outcome === "landed" && counting.counts.send === 0 && counting.counts.simulate === 0, `F reconciled ${recovered[0]?.outcome}; nothing re-simulated or re-sent`);
  const heldAfterF = (await vaultHeld(owner.address, await onchainOf(w.market))).downRaw;
  check(heldAfterF > heldF, `F filled exactly once: Down ${heldF} → ${heldAfterF} raw`);
  results.killedTap = { txHash: open[0]!.txHash };
  d.log({ step: "F killed tap", signature: open[0]!.txHash!, note: "co-signed, journaled, SIGKILLed, reconciled confirmed by signature" });

  // G. Revoke: the remaining budget returns to the Trading Balance; the owner signs, the sponsor pays.
  console.log("G. revoke");
  state = await vaultState(owner.address);
  const budget = state.session!.budgetBase;
  const revoke = await ownerSponsored.submitter.submitTx({ kind: "vault-revoke", grantId }, phases("G"));
  check(revoke.status === "confirmed", `G revoke (${why(revoke)})`);
  const revokeTx = await signersOf(revoke.txHash);
  const afterRevoke = await vaultState(owner.address);
  check(afterRevoke.session === null && afterRevoke.available - state.available === budget && revokeTx.feePayer === sponsor.address, `G budget ${budget} returned; fee payer = sponsor`);
  results.revoke = { txHash: revoke.txHash, returned: budget };
  d.log({ step: "G revoke", signature: revoke.txHash, note: `returned ${budget}, sponsored` });

  await settleAndClose(d, w, market, { owner, cranker, deployment, results, fixturesDir, ownerSponsored, sponsorAddress: sponsor.address });
  return results;
}

async function settleAndClose(d: Drive, w: Awaited<ReturnType<typeof openWindow>>, market: EventMarket, x: { owner: User; cranker: User; deployment: { seat: string }; results: Record<string, unknown>; fixturesDir: string; ownerSponsored: Awaited<ReturnType<typeof ownerSession>>; sponsorAddress: string }) {
  console.log("settle (Up wins)");
  await travel(d, w.expirySec + 11);
  await attest(d, w, WHICH.close, w.expirySec, CLOSE_E8);
  await travel(d, w.expirySec + 125);
  await settleWindow(d.ctx, w);

  // H. A stranger cranks; the payout always lands on the owner.
  console.log("H. third-party crank");
  const settler = await createOpsClient({ rpcUrl: d.rpcUrl, rpcSubscriptionsUrl: d.wsUrl, payerSecret: d.secretOf("settler") });
  const planned = await planVaultCranks(settler, w.market);
  check(planned.length === 1 && planned[0]!.owner === x.owner.address, `H planVaultCranks finds the owner's slot (${planned[0]?.yesLots} YES / ${planned[0]?.noLots} NO lots)`);
  const heldH = await vaultHeld(x.owner.address, await onchainOf(w.market));
  const availableH = (await vaultState(x.owner.address)).available;
  const crank = await (await ownerSession(d, x.cranker, `${d.scratch}/vault-cranker-journal.json`)).submitter.submitTx({ kind: "vault-crank-settle", owner: x.owner.address as never, marketId: market.marketId }, phases("H"));
  check(crank.status === "confirmed", `H crank (${why(crank)})`);
  const paid = (await vaultState(x.owner.address)).available - availableH;
  check(paid === heldH.upRaw && (await signersOf(crank.txHash)).feePayer === x.cranker.address, `H owner credited ${paid} = ${heldH.upRaw} winning Up raw; Down pays 0; cranked by ${x.cranker.address}`);
  await saveFixture(crank.txHash, `${x.fixturesDir}/vault-crank-settle.json`, "Surfpool devnet fork: public_crank_settle by a third party (S7b drive)");
  x.results.crank = { txHash: crank.txHash, paid };
  d.log({ step: "H crank", signature: crank.txHash, note: `+${paid} to the owner's Trading Balance` });

  // The settler drains the user seats, then the Ledger closes (the vault seat drained by the crank).
  console.log("Ledger close");
  const [view] = await fetchMarkets(settler, [w.market]);
  const config = await readVenueConfig(settler);
  await sendOps(settler, [await sweepInstruction(view!)], "sweep");
  const ledger = (await readLedger(settler, w.ledger))!;
  for (const seat of ledger.seats.filter((s) => !isProgramSeat(s))) await sendOps(settler, await redeemForInstructions(settler, view!, config, seat), "redeem_for");
  const close = await sendOps(settler, [await closeLedgerInstruction(view!, config, ledger.rentPayer)], "close_ledger");
  check((await readLedger(settler, w.ledger)) === null, `Ledger ${w.ledger} closed after the vault seat was cranked`);
  x.results.ledgerClose = { txHash: close.signature };
  d.log({ step: "ledger close", signature: close.signature, note: "every seat drained, vault seat included" });

  // I. Withdraw everything to the owner's ATA; sponsored because the ATA exists.
  console.log("I. withdraw");
  const all = (await vaultState(x.owner.address)).available;
  const tokenI = (await walletHeld(w.ledger, d.mint, x.owner.address)).tokenBase;
  const out = await x.ownerSponsored.submitter.submitTx({ kind: "vault-withdraw", amountBase: all }, phases("I"));
  check(out.status === "confirmed", `I withdraw (${why(out)})`);
  const tokenAfter = (await walletHeld(w.ledger, d.mint, x.owner.address)).tokenBase;
  check(tokenAfter - tokenI === all && (await vaultState(x.owner.address)).available === 0n && (await signersOf(out.txHash)).feePayer === x.sponsorAddress, `I withdrew ${all} to the owner's ATA; sponsored`);
  x.results.withdraw = { txHash: out.txHash, amount: all };
  d.log({ step: "I withdraw", signature: out.txHash, note: `${all} → owner ATA` });
}

/** Proof F's second process: the executor actor taps, and the process dies the moment the co-signed bytes are sent. */
export async function killedTapChild(statePath: string) {
  const state = JSON.parse(readFileSync(statePath, "utf8"), (_k, v) => (typeof v === "string" && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v));
  const d = await openDrive({ cluster: "localnet", rpcUrl: state.rpcUrl, wsUrl: state.wsUrl, scratch: "" });
  await pointAtVault(d);
  const signer = await keypairSigner(Uint8Array.from(state.secret));
  const actor = { label: "actor", secret: Uint8Array.from(state.secret), address: signer.address, signer, token: "" } as User;
  const sponsor = await countingSponsor(d);
  const killer = hookedRpc({ afterFirstSend: () => process.kill(process.pid, "SIGKILL") });
  const session = await ownerSession(d, actor, state.journalPath, sponsor.cosigner, killer.rpc);
  const quote = await quoteNow(d, state.market, "down", TUSDC);
  await session.submitter.submitOrder({ market: state.market, side: "down", stakeBase: TUSDC, displayedQuote: quote, wallet: session.address, route: { kind: "vault-grant", grantId: BigInt(state.grantId) } }, phases("F child"));
  await sleep(60_000);
  throw new Error("the child was not killed after its send");
}
