#!/usr/bin/env -S pnpm exec tsx
// S18 Pre-IPO lane, end to end on devnet (D-100): the Stocklana PreStocks track. Registers an attested-primary Series
// for one PreStocks pre-IPO token, opens a 5-minute Window on it, reads the public catalogue at each boundary, signs
// the price with the venue's price-attestor and records it as an attested print, then settles the Window on the pair.
//
// Attested-primary with no cross-check is deliberate (D-101): no second venue publishes a pre-IPO mark, so a check
// source would void every Window. `validate_policy_version` admits a zero check policy exactly for this case. What a
// Pre-IPO settlement trusts is the venue's own signature over the 158 B message, not PreStocks — the README says so.
//
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/prestocks-attest.ts [--cluster devnet]
//        [--symbol OPENAI] [--ticker 910] [--cadence 300] [--bar current|next] [--with-call] [--resume-index N]
//        [--dry-run] [--scratch <dir>]
//   --resume-index adopts a Window this Series already has open (after a crashed run) instead of opening a new one: it
//     assumes the opening print landed, records the closing one and settles, which also frees the Book again. Resume
//     within MAX_LATE_SEC of the boundary: past it there is no honest closing price to sign, and the right outcome is
//     to let the Window void on a missing print rather than settle it on a stale one.
//   --with-call funds two throwaway users and trades the Window for real: a maker rests a post-only NO bid, a taker
//     crosses it with an IOC YES buy, and both seats redeem after settlement. Without it the Window settles empty.
//   --bar current (default) opens the bar already in progress: its open boundary has passed, so that print lands at
//     once and only the close is waited out. --bar next opens a whole bar before it starts, the way the roller does.
//     A bar that has already closed cannot be opened at all: `check_window` rule 5 requires `lock_at > now`.
// Payer and admin: the deployer (GlobalConfig admin, D-026). Signing authority: price-attestor, already in config.attestors.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDeployClient, ensureBooks, ensureSeries, keypairSigner, KIND, openWindow, ORDER_TYPE, placeOrder, preStocksFeedId,
  preStocksSeries, PRESTOCKS_TICKER_BASE, recordAttestedPrint, redeem, seatHintFor, seriesAddress, settleWindow,
  windowAddresses, WHICH, type OpenedWindow, type StepContext,
} from "@agari/markets/deploy";
import { fetchPreStocks, PRESTOCKS_MAX_LATE_SEC, requireToken, type PreStocksRead, type PreStocksToken } from "@agari/markets/ops/prints";
import { addressesFor, arg, clusterArg, endpoints, flag, redactKey } from "../deploy/ops-cluster";
import { check, openDrive, sleep } from "./first-call-kit";

const cluster = clusterArg();
const symbol = arg("--symbol", "OPENAI").toUpperCase();
const cadenceSec = Number(arg("--cadence", "300"));
const ticker = Number(arg("--ticker", String(PRESTOCKS_TICKER_BASE)));
const bar = arg("--bar", "current");
const withCall = flag("--with-call");
const resumeIndex = arg("--resume-index", "");
const dryRun = flag("--dry-run");
const scratch = arg("--scratch", `/tmp/agari-prestocks-${symbol.toLowerCase()}`);
if (!Number.isInteger(cadenceSec) || cadenceSec < 60) throw new Error(`--cadence must be whole seconds >= 60, got ${cadenceSec}`);
if (!Number.isInteger(ticker) || ticker < 1) throw new Error(`--ticker must be a positive whole number, got ${ticker}`);
if (bar !== "current" && bar !== "next") throw new Error(`--bar must be "current" or "next", got "${bar}"`);

const spec = preStocksSeries(symbol, ticker, cadenceSec);
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const feedId = preStocksFeedId(symbol);
const MIN_DELAY_SEC = spec.versions[0]!.primary.minDelaySec;
const BAR_LEN_SEC = spec.versions[0]!.primary.barLenSec;
const ADMISSION_SEC = spec.versions[0]!.primary.openAdmissionSec;
// The print claims to be the `BAR_LEN_SEC` bar ending at the boundary. The program only bounds the read from below, by
// the correction delay, and above by `now` — 900 s of admission would happily accept a price read a quarter of an hour
// late and sign it as that bar. This is the drive's own upper bound, and the only guard against a silently wrong price.
// Shared with the relay pass, so the drive and ops can never disagree about what "on time" means.
const MAX_LATE_SEC = PRESTOCKS_MAX_LATE_SEC;

// A first read before anything is sent: if PreStocks cannot price the symbol there is no lane to build.
const opening = await fetchPreStocks();
const first = requireToken(opening, symbol);
const usd = (e8: bigint) => `$${(Number(e8) / 1e8).toFixed(4)}`;
console.log(`prestocks-attest ${spec.key} on ${cluster} (${label})`);
console.log(`  ${first.name} (${first.symbol}) mint ${first.mint}`);
console.log(`  mark ${usd(first.markPriceE8)}  token ${usd(first.tokenPriceE8)}  (the lane prints the token price)`);
console.log(`  feed id "prestocks-v1:${symbol}", ${BAR_LEN_SEC} s bars, ${MIN_DELAY_SEC} s correction delay, attested primary, no cross-check`);
if (dryRun) {
  console.log(`  DRY RUN: would register ticker ${ticker} / ${cadenceSec} s and open the ${bar} ${cadenceSec} s bar${withCall ? ", then trade it with two funded users" : ""}`);
  process.exit(0);
}

const d = await openDrive({ cluster, rpcUrl, wsUrl: rpcSubscriptionsUrl, scratch });
const { file, save } = addressesFor(cluster);
const ctx: StepContext = { ...d.ctx, record: file.venue, save: (next) => { Object.assign(file.venue, next); save(); } };
const attestor = await keypairSigner(d.secretOf("price-attestor"));
const roller = await keypairSigner(d.secretOf("roller"));
const prints: Array<{ which: string; boundaryTs: number; token: PreStocksToken; fetchedAtTs: number; signature: string }> = [];

/** Waits until the chain clock is past `atSec`, then reads PreStocks and records the boundary's attested print. */
async function attest(w: OpenedWindow, which: number, whichName: string, boundaryTs: number): Promise<void> {
  const earliest = boundaryTs + MIN_DELAY_SEC;
  for (;;) {
    const now = Math.floor(d.clock.nowMs() / 1000);
    if (now >= earliest) break;
    console.log(`  waiting ${earliest - now}s for the ${whichName} correction delay`);
    await sleep(Math.min(earliest - now, 30) * 1_000);
  }
  // One transient 502 must not strand a Window whose traders' collateral is already escrowed: the admission window is
  // 15 minutes wide, so the read is retried well inside it before the drive gives up.
  const deadline = boundaryTs + ADMISSION_SEC - 60;
  let read: PreStocksRead | null = null;
  for (let attempt = 1; read === null; attempt++) {
    try {
      read = await fetchPreStocks();
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      if (Math.floor(d.clock.nowMs() / 1000) + 10 >= deadline) throw new Error(`${whichName}: PreStocks unreadable before the admission deadline: ${why}`);
      console.log(`  ${whichName} read attempt ${attempt} failed, retrying: ${why}`);
      await sleep(5_000);
    }
  }
  const token = requireToken(read, symbol);
  check(token.mint === first.mint, `${whichName}: still the same instrument, mint ${token.mint}`);
  if (read.ageSec !== null) check(read.ageSec <= MIN_DELAY_SEC, `${whichName}: the body was not cached stale (age ${read.ageSec}s)`);
  // The catalogue carries no timestamp, so the venue stamps its own read against the chain's clock: the program needs
  // `boundary + min_delay <= fetched_at <= now`, and a local clock ahead of the chain's would fail the upper bound.
  const fetchedAtTs = Math.min(read.fetchedAtSec, Math.floor(d.clock.nowMs() / 1000));
  check(fetchedAtTs >= earliest, `${whichName}: read at ${fetchedAtTs}, past the ${MIN_DELAY_SEC}s correction delay that ended at ${earliest}`);
  check(fetchedAtTs - boundaryTs <= MAX_LATE_SEC, `${whichName}: read ${fetchedAtTs - boundaryTs}s after the boundary, within the ${MAX_LATE_SEC}s the ${BAR_LEN_SEC}s bar can still stand for`);
  const signature = await recordAttestedPrint(d.ctx, w, {
    attestor, clusterTag: d.clusterTag, which, boundaryTs, price: token.tokenPriceE8, feedId, barLenSec: BAR_LEN_SEC, fetchedAtTs,
  });
  console.log(`  ${whichName} print ${usd(token.tokenPriceE8)} (mark ${usd(token.markPriceE8)}) read at ${new Date(fetchedAtTs * 1000).toISOString()}`);
  prints.push({ which: whichName, boundaryTs, token, fetchedAtTs, signature });
}

try {
  const series = await ensureSeries(ctx, spec);
  await ensureBooks(ctx, spec, series);
  check(String(series) === String(await seriesAddress(spec.ticker, spec.cadenceSec, spec.basis)), `the Series sits at its derived address ${series}`);

  await d.clock.sync();
  const nowSec = Math.floor(d.clock.nowMs() / 1000);
  const thisBoundary = Math.floor(nowSec / cadenceSec) * cadenceSec;
  // `check_window` rule 5 wants the lock still ahead, and the open print needs `now >= boundary + min_delay`. The
  // current bar qualifies only while enough of it is left for the open transaction to land.
  const headroom = thisBoundary + cadenceSec - nowSec;
  // Trading needs time to fund two users and cross the book before the bar expires, so --with-call demands more room.
  const needed = MIN_DELAY_SEC + (withCall ? 150 : 30);
  // Past MAX_LATE_SEC into the bar, its opening print can no longer honestly be attested, so take the next one.
  const useCurrent = bar === "current" && headroom > needed && nowSec - thisBoundary <= MAX_LATE_SEC;
  if (bar === "current" && !useCurrent) {
    const why = nowSec - thisBoundary > MAX_LATE_SEC
      ? `its boundary passed ${nowSec - thisBoundary}s ago, more than the ${MAX_LATE_SEC}s an opening print may stand for`
      : `only ${headroom}s of it are left, too little to open and trade`;
    console.log(`  the current bar is out: ${why}. Taking the next one`);
  }
  const tradingStartSec = useCurrent ? thisBoundary : thisBoundary + cadenceSec;
  const expirySec = tradingStartSec + cadenceSec;
  console.log(`  window ${new Date(tradingStartSec * 1000).toISOString()} → ${new Date(expirySec * 1000).toISOString()} (${useCurrent ? "the bar in progress" : "the next bar"})`);

  let opened: OpenedWindow;
  if (resumeIndex !== "") {
    const w = await windowAddresses(series, BigInt(resumeIndex));
    const account = await d.client.agariEvents.accounts.market.fetch(w.market);
    opened = { ...w, book: account.data.book, mint: d.mint, tradingStartSec: Number(account.data.tradingStart),
      expirySec: Number(account.data.expiry), policyVersion: account.data.policyVersion, signature: "(resumed)" };
    console.log(`  resumed #${resumeIndex} ${new Date(opened.tradingStartSec * 1000).toISOString()} → ${new Date(opened.expirySec * 1000).toISOString()}, market ${opened.market}`);
  } else {
    opened = await openWindow(d.ctx, { roller, series, mint: d.mint, tradingStartSec });
    // Written before anything can fail, so a crashed run is recoverable with --resume-index instead of stranding the
    // Window, its Book and any collateral already escrowed in it.
    mkdirSync(scratch, { recursive: true });
    writeFileSync(resolve(scratch, "open-window.json"), `${JSON.stringify({ seriesKey: spec.key, series: String(series), market: String(opened.market), index: String(opened.index), tradingStartSec: opened.tradingStartSec, expirySec: opened.expirySec }, null, 2)}\n`);
    await attest(opened, WHICH.open, "open", opened.tradingStartSec);
  }

  // A real position on the Window, so the lane is something a person can take a side on rather than an empty Series.
  // The two sides are complete-set bids: YES at `p` crosses NO at `1000 − p`, and the taker fills at the rest's price.
  const traders: Array<{ label: string; address: string; token: string; seatIdx: number; secret: Uint8Array }> = [];
  let fill: { restSignature: string; fillSignature: string; yesTicks: number; noTicks: number; lots: bigint } | null = null;
  if (withCall) {
    const [maker, taker] = [await d.newUser("maker", 30_000_000n, 50_000_000n), await d.newUser("taker", 30_000_000n, 50_000_000n)];
    const clientOf = async (secret: Uint8Array) => createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: secret });
    const [makerClient, takerClient] = [await clientOf(maker.secret), await clientOf(taker.secret)];
    // YES ticks run 1..999 (`InvalidPrice` 6104 outside that), and the two sides cross when they sum past 1000.
    const [noTicks, yesTicks, lots] = [400, 650, 1_000n];
    const restSignature = await placeOrder({ client: makerClient, log: d.log }, opened, makerClient.payer, maker.token as never,
      { kind: KIND.buyNo, priceTicks: noTicks, lots, orderType: ORDER_TYPE.postOnly });
    const fillSignature = await placeOrder({ client: takerClient, log: d.log }, opened, takerClient.payer, taker.token as never,
      { kind: KIND.buyYes, priceTicks: yesTicks, lots, orderType: ORDER_TYPE.ioc });
    fill = { restSignature, fillSignature, yesTicks, noTicks, lots };
    for (const u of [maker, taker]) traders.push({ label: u.label, address: u.address, token: u.token, secret: u.secret, seatIdx: await seatHintFor(d.ctx, opened, u.address as never) });
    console.log(`  the taker called OPENAI UP at ${yesTicks / 10}¢ against a NO rest at ${noTicks / 10}¢, ${lots} lots`);
  }

  await attest(opened, WHICH.close, "close", opened.expirySec);

  const settle = await settleWindow(d.ctx, opened);
  const market = await d.client.agariEvents.accounts.market.fetch(opened.market);
  const { state, payoutYes, payoutNo, voidReason } = market.data;
  const [chainOpen, chainClose] = [BigInt(market.data.open.price), BigInt(market.data.close.price)];
  const close = prints[prints.length - 1]!.token.tokenPriceE8;
  const open = prints.length > 1 ? prints[0]!.token.tokenPriceE8 : chainOpen;
  // PD-3 (`resolve_rules.rs`): `close >= open` pays Up, so a tie is an Up, never a split.
  const call = close >= open ? "UP" : "DOWN";
  // The whole point of the drive is to rule out a wrong price, so the chain's own record is compared with what was
  // signed rather than assumed to match, and the payout is compared with the direction the prices imply.
  check(chainOpen === open, `the chain's opening print ${chainOpen} is the price the attestor signed`);
  check(chainClose === close, `the chain's closing print ${chainClose} is the price the attestor signed`);
  check(call === "UP" ? payoutYes > payoutNo : payoutNo > payoutYes,
    `the payout (YES ${payoutYes} / NO ${payoutNo}) agrees with the ${call} the prints imply (a tie pays Up, PD-3)`);
  console.log(`  settled ${opened.market}: ${usd(open)} → ${usd(close)}, the close called ${call}`);
  console.log(`  market state ${state}, payout YES ${payoutYes} / NO ${payoutNo}${voidReason ? `, void reason ${voidReason}` : ""}`);
  check(voidReason === 0, "the Window settled on the two prints with no void reason");

  const redemptions: Array<{ label: string; seatIdx: number; signature: string }> = [];
  for (const t of traders) {
    const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: t.secret });
    redemptions.push({ label: t.label, seatIdx: t.seatIdx, signature: await redeem({ client, log: d.log }, opened, client.payer, t.token as never, t.seatIdx) });
  }
  if (redemptions.length > 0) console.log(`  both seats redeemed: ${redemptions.map((r) => `${r.label} seat ${r.seatIdx}`).join(", ")}`);

  mkdirSync(scratch, { recursive: true });
  const out = resolve(scratch, `prestocks-${symbol.toLowerCase()}-${opened.tradingStartSec}.json`);
  writeFileSync(out, `${JSON.stringify({
    lane: "pre-ipo", source: "prestocks", symbol, seriesKey: spec.key, ticker, cadenceSec, bar: useCurrent ? "current" : "next",
    series: String(series), market: String(opened.market), book: String(opened.book), mint: first.mint,
    tradingStartSec: opened.tradingStartSec, expirySec: opened.expirySec, index: String(opened.index),
    openSignature: opened.signature, settleSignature: settle,
    outcome: call, state, payoutYes, payoutNo, voidReason, resolvedTs: Number(market.data.resolvedTs),
    fill: fill ? { ...fill, lots: String(fill.lots) } : null,
    traders: traders.map((t) => ({ label: t.label, address: t.address, seatIdx: t.seatIdx })), redemptions,
    prints: prints.map((p) => ({ ...p, token: { ...p.token, markPriceE8: String(p.token.markPriceE8), tokenPriceE8: String(p.token.tokenPriceE8) } })),
    evidence: d.evidence,
  }, null, 2)}\n`);
  console.log(`evidence → ${out}`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
