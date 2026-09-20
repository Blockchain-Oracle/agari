#!/usr/bin/env -S pnpm exec tsx
// S18 cover call: one real cover bet against the live house maker, on whichever Window a Series has open right now.
//
// This is the product's own claim, proved on chain: someone who holds a stock token can buy Down as cover and a
// counterparty is actually there. The card offers exactly this order — the drive is the card's button, without a
// browser. It funds one throwaway wallet, reads the top of the Window's book, prices an IOC that crosses whatever the
// maker is resting, sends it, and reads the seat back to say what filled and at what price.
//
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/cover-call.ts [--cluster devnet]
//        [--series <address>] [--side down|up] [--lots 1000] [--margin 20] [--check] [--scratch <dir>]
//   --side down (default) buys NO, the cover. --side up buys YES, the "add to it" the card offers beside it.
//   --margin is the extra ticks past the crossing price, so a requote between the read and the send does not turn the
//     IOC into a no-op. It costs nothing: an IOC fills at the resting order's price, never at the taker's limit.
//   --check reads and prices everything and sends nothing.
//
// The book is YES-quoted (`readBookTop`): the bid side holds BUY_YES at their YES price, the ask side holds BUY_NO at
// `1000 − their NO price`. A BUY_NO at `n` crosses a resting BUY_YES at `q` when `n + q > 1000`, and fills at `1000 − q`.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDeployClient, KIND, ORDER_TYPE, placeOrder, seatHintFor, windowAddresses, type OpenedWindow } from "@agari/markets/deploy";
import { readBookTop } from "@agari/markets/ops/maker";
import { arg, clusterArg, endpoints, flag } from "../deploy/ops-cluster";
import { check, openDrive } from "./first-call-kit";

const cluster = clusterArg();
/** The live 24/7 OpenAI lane (`OPENAI-60m`, D-105), registered 2026-09-19. */
const DEFAULT_SERIES = "6u4hgFGAfoFTQxaRe4hB9m7cLWqpywwwMXVb8u7JqLqG";
const series = arg("--series", DEFAULT_SERIES);
const side = arg("--side", "down");
const lots = BigInt(arg("--lots", "1000"));
const margin = Number(arg("--margin", "20"));
const checkOnly = flag("--check");
const scratch = arg("--scratch", "/tmp/agari-cover-call");
if (side !== "down" && side !== "up") throw new Error(`--side must be "down" or "up", got "${side}"`);
if (lots <= 0n) throw new Error(`--lots must be positive, got ${lots}`);
if (!Number.isInteger(margin) || margin < 1) throw new Error(`--margin must be a positive whole number of ticks, got ${margin}`);

/** Entry closes 30 s before lock (D-011), so an order sent inside that window is refused rather than filled. */
const ENTRY_CLOSES_BEFORE_LOCK_SEC = 30;
const SOL_LAMPORTS = 30_000_000n;
const TUSDC_BASE = 50_000_000n;

const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const usd = (base: bigint, decimals: number) => `$${(Number(base) / 10 ** decimals).toFixed(4)}`;
const cents = (ticks: number) => `${(ticks / 10).toFixed(1)}¢`;

async function main() {
  const d = await openDrive({ cluster, rpcUrl, wsUrl: rpcSubscriptionsUrl, scratch });
  console.log(`cover call on ${cluster} (${label}): ${side.toUpperCase()} ${lots} lots on series ${series}`);

  const s = await d.client.agariEvents.accounts.series.fetch(series as never);
  check(s.data.nextIndex > 0n, `series ${series} has opened at least one Window (next_index ${s.data.nextIndex})`);
  const index = s.data.nextIndex - 1n;
  const w = await windowAddresses(series as never, index);
  const m = await d.client.agariEvents.accounts.market.fetch(w.market);
  const nowSec = Math.floor(d.clock.nowMs() / 1000);
  const [tradingStart, lockAt, expiry] = [Number(m.data.tradingStart), Number(m.data.lockAt), Number(m.data.expiry)];
  const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 19);
  console.log(`  Window #${index} ${iso(tradingStart)}–${iso(expiry)}Z, locks ${iso(lockAt)}Z, ${lockAt - nowSec} s of entry left`);

  check(nowSec >= tradingStart, `Window #${index} has started trading (${iso(tradingStart)}Z)`);
  check(nowSec < lockAt - ENTRY_CLOSES_BEFORE_LOCK_SEC, `entry is still open: it closes ${ENTRY_CLOSES_BEFORE_LOCK_SEC} s before lock at ${iso(lockAt)}Z`);

  const top = await readBookTop(d.client, m.data.book);
  check(top !== null, `the Window's Book ${m.data.book} is readable`);
  console.log(`  book: best YES bid ${top.bestBidTicks === null ? "none" : cents(top.bestBidTicks)}, best NO rest at YES ${top.bestAskTicks === null ? "none" : cents(top.bestAskTicks)}, ${top.orderCount} orders`);

  // A cover (BUY_NO) takes the resting BUY_YES; an add (BUY_YES) takes the resting BUY_NO, which sits at `1000 − ask`.
  const restTicks = side === "down" ? top.bestBidTicks : top.bestAskTicks;
  check(restTicks !== null, side === "down" ? "the maker is resting a YES bid for a cover bet to take" : "the maker is resting a NO offer for an Up bet to take");
  const fillTicks = side === "down" ? 1_000 - restTicks : restTicks;
  const limitTicks = Math.min(999, fillTicks + margin);
  check(limitTicks + (side === "down" ? restTicks : 1_000 - restTicks) > 1_000, `the limit ${limitTicks} crosses the rest at ${restTicks} (the two sides must sum past 1000)`);

  const decimals = 6;
  const costBase = BigInt(fillTicks) * s.data.cashUnit * lots;
  const payoutBase = 1_000n * s.data.cashUnit * lots;
  console.log(`  a ${side === "down" ? "cover" : "add"} of ${lots} lots fills at ${cents(fillTicks)} → ${usd(costBase, decimals)} staked, ${usd(payoutBase, decimals)} back if ${side === "down" ? "DOWN" : "UP"} wins`);
  console.log(`  sending IOC at ${cents(limitTicks)} (${margin} ticks past the cross, so a requote cannot make it a no-op)`);
  if (checkOnly) return console.log("  --check: nothing sent");

  const user = await d.newUser(`cover-${side}`, SOL_LAMPORTS, TUSDC_BASE);
  const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: user.secret });
  const opened: OpenedWindow = {
    series: series as never, index, market: w.market, ledger: w.ledger, mvault: w.mvault, book: m.data.book,
    mint: d.mint, tradingStartSec: tradingStart, expirySec: expiry, policyVersion: m.data.policyVersion, signature: "",
  };
  const signature = await placeOrder({ client, log: d.log }, opened, client.payer, user.token as never,
    // Trading stops at `lock_at`, which the Gap lane sets days before expiry; an expiry past it is refused
    // with 6108 (ExpiryAfterLock), which is why this drive could never trade a Gap Window.
    // The engine takes every price in YES ticks, a BUY_NO's included: it sits on the ask side and crosses a bid
    // when `bid ≥ limit`. `limitTicks` is what the buyer pays for NO, so the YES price sent is `1000 − limitTicks`.
    // This sent the NO price itself until 2026-09-20. It still filled whenever Down was cheap (a 16.4¢ limit is
    // under an 85.6¢ bid either way), which is why the first cover fills worked and a 50/50 book filled nothing.
    { kind: side === "down" ? KIND.buyNo : KIND.buyYes, priceTicks: side === "down" ? 1_000 - limitTicks : limitTicks, lots, orderType: ORDER_TYPE.ioc, expireTs: lockAt });

  // The order is only evidence if it actually filled: an IOC that crossed nothing leaves the seat empty and says so.
  const seatIdx = await seatHintFor(d.ctx, opened, user.address as never);
  const after = await d.client.agariEvents.accounts.market.fetch(w.market);
  const filledLots = after.data.volumeLots - m.data.volumeLots;
  const filledCash = after.data.volumeCash - m.data.volumeCash;
  check(filledLots > 0n, `the IOC filled against the maker (${filledLots} lots crossed, market volume ${m.data.volumeLots} → ${after.data.volumeLots})`);
  // `volumeCash` is counted on the YES side, so it is the maker's leg, not the taker's: a cover's own cost is `1000 − last`.
  const paidTicks = side === "down" ? 1_000 - after.data.lastPrice : after.data.lastPrice;
  const paidBase = BigInt(paidTicks) * s.data.cashUnit * filledLots;
  console.log(`  filled ${filledLots} lots at ${cents(after.data.lastPrice)} YES: the ${side === "down" ? "cover" : "add"} paid ${usd(paidBase, decimals)} (${cents(paidTicks)}) plus a ${usd(s.data.seatBond, decimals)} seat bond, seat ${seatIdx}`);
  console.log(`  market volume ${usd(filledCash, decimals)}, counted on the YES side (the maker's leg)`);
  console.log(`  ${signature}`);

  mkdirSync(scratch, { recursive: true });
  const out = resolve(scratch, `cover-${side}-${w.market}-${nowSec}.json`);
  writeFileSync(out, `${JSON.stringify({
    lane: "pre-ipo", side, series, index: String(index), market: String(w.market), book: String(m.data.book),
    tradingStartSec: tradingStart, lockAtSec: lockAt, expirySec: expiry,
    restTicks, fillTicks, limitTicks, lots: String(lots),
    filledLots: String(filledLots), filledCashBase: String(filledCash), lastPriceTicks: after.data.lastPrice,
    paidTicks, paidBase: String(paidBase), seatBondBase: String(s.data.seatBond),
    trader: user.address, seatIdx, signature, evidence: d.evidence,
  }, null, 2)}\n`);
  console.log(`  evidence → ${out}`);
}

await main();
