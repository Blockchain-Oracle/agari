#!/usr/bin/env -S pnpm exec tsx
// S18 pre-open drive on devnet (D-088, D-089, D-090): on a prelisted Regular Window before its bell, (a) a pre-open call
// (UP post-only at 55¢ through the submitter's rest lane, default expiry trading_start + 90 s) rests; (b) a far call at 20¢
// rests and is left for the bell's expiry → sweep → credit → crank-redeem; (c) an IOC taker is refused with 6121
// PreOpenTakerRefused, sent without preflight so the refusal lands on chain. Users are funded by the sol-faucet role (SOL
// and ATA rent) and the faucet mint authority (tUSDC); their keys are written only under --scratch, outside the repo,
// because the bell check needs them to observe fills and cancel.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/preopen-devnet.ts --scratch DIR [--series TSLA-5m]
//        [--index 64] [--dry-run]

import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { restingQuote } from "@agari/core";
import { keypairAddress, readMarket, readSeries, readTokenBalance, solana } from "@agari/markets";
import { createDeployClient, KIND, keypairSigner, ORDER_TYPE, placeOrder, windowAddresses, type OpenedWindow } from "@agari/markets/deploy";
import { chainNowSec, createOpsClient, eventAuthority } from "@agari/markets/ops";
import { decodeTransactionEvents, type RawTransaction } from "@agari/markets/ops/indexer";
import { readPlaceOutcome } from "@agari/markets/ops/maker";
import { lamportsOf, mintCollateral, transferSol } from "@agari/markets/ops/roller";
import { arg, endpoints, flag, redactKey } from "../deploy/ops-cluster";
import { costOf, openDrive, phases, userSession, type Drive } from "./first-call-kit";

const STOP_REASON = ["Filled", "NoCross", "FillCap", "SkipCap", "PostOnlyRested"] as const;
const USER_LAMPORTS = 20_000_000n;
const USER_TUSDC = 2_000_000n;
const PRE_OPEN_CENTS = 55;
const FAR_CENTS = 20;
const TAKER_TICKS = 600;

const dryRun = flag("--dry-run");
const scratch = resolve(arg("--scratch", ""));
if (!arg("--scratch", "") || scratch.startsWith(resolve("."))) throw new Error("--scratch must name a directory outside the repo (the users' keys go there)");
const seriesKey = arg("--series", "TSLA-5m");
const index = BigInt(arg("--index", "64"));
const { rpcUrl, rpcSubscriptionsUrl: wsUrl, label } = endpoints("devnet");
const iso = (sec: number | bigint) => new Date(Number(sec) * 1000).toISOString();
const link = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const jsonSafe = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);

type Saved = { label: string; address: string; secret: number[] };
type Actor = { label: string; address: string; secret: Uint8Array; token: string };

function loadOrCreateUsers(path: string, labels: readonly string[]): Actor[] {
  const saved: Saved[] = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Saved[]) : [];
  for (const name of labels) {
    if (saved.some((u) => u.label === name)) continue;
    const jwk = generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" });
    const secret = [...Buffer.from(jwk.d!, "base64url"), ...Buffer.from(jwk.x!, "base64url")];
    saved.push({ label: name, address: keypairAddress(Uint8Array.from(secret)), secret });
  }
  // Written before any funding, so a crash never strands a funded key.
  writeFileSync(path, `${JSON.stringify(saved, null, 2)}\n`, { mode: 0o600 });
  return saved.map((u) => ({ label: u.label, address: u.address, secret: Uint8Array.from(u.secret), token: "" }));
}

async function main() {
  const d: Drive = await openDrive({ cluster: "devnet", rpcUrl, wsUrl, scratch });
  const series = d.venue.series?.[seriesKey];
  if (!series) throw new Error(`addresses.devnet.json has no Series ${seriesKey}`);
  const w = await windowAddresses(series.address as never, index);
  const account = await readMarket(w.market);
  if (!account) throw new Error(`${seriesKey} #${index} (${w.market}) is not listed`);
  const facts = await readSeries(series.address as never);
  const [tradingStart, lockAt, nowSec] = [Number(account.data.tradingStart), Number(account.data.lockAt), await chainNowSec(d.client)];
  console.log(`pre-open drive on devnet (${label}): ${seriesKey} #${index} market ${w.market}, book ${account.data.book}, ledger ${w.ledger}`);
  console.log(`  state ${account.data.state}, trading ${iso(tradingStart)} → lock ${iso(lockAt)}, chain now ${iso(nowSec)}; grid lot ${facts.lotBase} tick ${facts.tickBase} cu ${facts.cashUnit} min ${facts.minLots} bond ${facts.seatBond}`);
  if (account.data.state !== 0 || nowSec >= tradingStart) throw new Error("the Window is not Listed before its bell: nothing to drive");

  const stakeAt = (cents: number) => facts.minLots * BigInt(cents * 10) * facts.cashUnit;
  const quoteAt = (cents: number) => {
    const sized = restingQuote({ side: "up", priceCents: cents, stakeBase: stakeAt(cents), grid: facts, decimals: 6, quotedAtMs: d.clock.nowMs() });
    if (!sized.ok) throw new Error(`no resting quote at ${cents}¢: ${sized.blocker}`);
    return sized.quote;
  };
  for (const cents of [PRE_OPEN_CENTS, FAR_CENTS]) console.log(`  UP ${cents}¢: stake ${stakeAt(cents)} base → ${quoteAt(cents).contractsRaw / facts.lotBase} lots, escrow ${quoteAt(cents).maxCostBase}`);
  const faucet = await createOpsClient({ rpcUrl, rpcSubscriptionsUrl: wsUrl, payerSecret: d.secretOf("sol-faucet") });
  const faucetHolds = await lamportsOf(faucet, faucet.payer.address);
  console.log(`  funding from sol-faucet ${faucet.payer.address} (${faucetHolds} lamports): 3 users × ${USER_LAMPORTS} lamports + ATA rent, tUSDC by the faucet mint authority`);
  if (dryRun) {
    console.log("DRY RUN: nothing sent");
    return;
  }

  const usersPath = `${scratch}/preopen-users.json`;
  const users = loadOrCreateUsers(usersPath, ["pre-open", "far", "taker"]);
  console.log(`  user keys → ${usersPath} (0600)`);
  const mintAuthority = await keypairSigner(d.secretOf("faucet-mint-authority"));
  for (const u of users) {
    const have = await lamportsOf(faucet, u.address as never);
    if (have < USER_LAMPORTS) d.log({ step: `fund SOL ${u.label}`, signature: await transferSol(faucet, u.address as never, USER_LAMPORTS - have), note: `${USER_LAMPORTS - have} lamports sol-faucet → ${u.address}` });
    const token = await readTokenBalance(u.address as never, d.mint as never);
    const base = token.amountBase ?? 0n;
    if (base < USER_TUSDC) d.log({ step: `fund tUSDC ${u.label}`, signature: await mintCollateral(faucet, { faucet: mintAuthority, mint: d.mint as never, owner: u.address as never, amount: USER_TUSDC - base }), note: `${USER_TUSDC - base} base → ${u.address}` });
    u.token = String(token.ata);
  }

  const market = {
    marketId: w.market, venueId: d.config, asset: seriesKey.split("-")[0], lane: "regular", question: "", intervalSec: facts.cadenceSec,
    tradingStartSec: tradingStart, lockAtSec: lockAt, expirySec: Number(account.data.expiry), poolAddress: account.data.book, marketAddress: w.market,
    seriesAddress: series.address, nonce: w.index, policyVersion: account.data.policyVersion, printSource: "pyth", collateral: d.mint, decimals: 6,
    status: "Listed", winningOutcome: null, voided: false, voidReason: null, finalized: false, openingPriceRaw: null, volumeQuoteRaw: 0n, tradeCount: 0,
    lastPriceRaw: null, resolvedAtMs: null,
  } as never;
  const programId = String((JSON.parse(readFileSync("scripts/deploy/addresses.devnet.json", "utf8")) as { programs: { agari_events: { programId: string } } }).programs.agari_events.programId);
  const authority = String(await eventAuthority());
  const results: Record<string, unknown> = { market: w.market, series: series.address, index: String(index), usersPath };

  async function orderExecuted(signature: string) {
    const tx = await solana().rpc.getTransaction(signature as never, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send();
    const decoded = tx ? decodeTransactionEvents(tx as unknown as RawTransaction, programId, authority) : null;
    return decoded?.events.find((e) => e.name === "OrderExecuted")?.data ?? null;
  }

  for (const [step, user, cents] of [["pre-open call", users[0]!, PRE_OPEN_CENTS], ["far call", users[1]!, FAR_CENTS]] as const) {
    await d.clock.sync();
    const session = await userSession(d, { ...user, signer: await keypairSigner(user.secret) } as never, `${scratch}/preopen-${user.label}-journal.json`);
    const quote = quoteAt(cents);
    const out = await session.submitter.submitOrder({ market, side: "up", stakeBase: stakeAt(cents), displayedQuote: quote, wallet: user.address as never, entry: "rest" }, phases(step));
    if (out.status !== "resting") throw new Error(`${step}: expected resting, got ${out.status}${"diagnosis" in out ? `: ${out.diagnosis.technical}` : ""}`);
    const sig = String(out.rested.txHash);
    const [event, place, cost] = await Promise.all([orderExecuted(sig), readPlaceOutcome(faucet, sig), costOf(sig)]);
    const stop = event ? STOP_REASON[Number(event.stopReason ?? event.stop_reason)] : null;
    const expire = event ? Number(event.expireTs ?? event.expire_ts) : null;
    d.log({ step, signature: sig, note: `${user.address} UP ${cents}¢: rested ${out.rested.lots} lots @ ${out.rested.priceTicks} YES ticks, escrow ${out.rested.escrowBase}; OrderExecuted stop_reason ${stop}, expire_ts ${expire === null ? "?" : iso(expire)}; PlaceResult rested ${place?.restedLots} filled ${place?.filledLots}; ${cost.computeUnits} CU, ${cost.bytes} B` });
    results[step] = { user: user.address, signature: sig, link: link(sig), rested: out.rested, stopReason: stop, expireTs: expire, place, cost };
  }

  // (c) The order lane refuses a taker on a Listed Window before signing, so the refusal is built directly and sent
  // without preflight: the program, not the client, answers.
  const taker = users[2]!;
  const takerClient = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl: wsUrl, payerSecret: taker.secret, skipPreflight: true });
  const opened: OpenedWindow = { ...w, book: account.data.book as never, mint: d.mint as never, tradingStartSec: tradingStart, expirySec: lockAt, policyVersion: account.data.policyVersion, signature: "" };
  const before = new Date();
  let refusal: Record<string, unknown>;
  try {
    const sig = await placeOrder({ client: takerClient, log: d.log }, opened, takerClient.payer, taker.token as never, { kind: KIND.buyYes, priceTicks: TAKER_TICKS, lots: facts.minLots, orderType: ORDER_TYPE.ioc });
    throw new Error(`the pre-open IOC landed without an error: ${sig}`);
  } catch (error) {
    const message = redactKey(error instanceof Error ? error.message : String(error));
    const recent = await solana().rpc.getSignaturesForAddress(taker.address as never, { limit: 5 }).send();
    const failed = recent.find((r) => r.err !== null && r.blockTime !== null && Number(r.blockTime) * 1000 >= before.getTime() - 5_000);
    if (failed) {
      const tx = await solana().rpc.getTransaction(failed.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send();
      const line = (tx?.meta?.logMessages ?? []).find((l) => /6121|PreOpenTaker/.test(l)) ?? null;
      d.log({ step: "pre-open taker", signature: String(failed.signature), note: `landed failed: ${JSON.stringify(failed.err, jsonSafe)}; ${line ?? "no 6121 log line"}` });
      refusal = { landed: true, signature: failed.signature, link: link(String(failed.signature)), err: failed.err, logLine: line };
    } else {
      d.log({ step: "pre-open taker", signature: null, note: `did not land; client error: ${message.split("\n").slice(0, 4).join(" | ")}` });
      refusal = { landed: false, error: message };
    }
  }
  results["pre-open taker"] = refusal;
  writeFileSync(`${scratch}/preopen-evidence.json`, `${JSON.stringify({ ...results, evidence: d.evidence }, jsonSafe, 2)}\n`);
  console.log(`evidence → ${scratch}/preopen-evidence.json`);
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
