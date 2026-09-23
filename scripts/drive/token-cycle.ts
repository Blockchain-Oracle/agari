#!/usr/bin/env -S pnpm exec tsx
// S6 token-lane drive on a Surfpool devnet fork carrying the upgraded `.so` (session-lanes.md §2.3 step 2 and §2.6;
// D-055, D-073, D-088). Localnet only: devnet is read for the queue account and one Surge quote, never written.
//   pin:      `admin_set_authorities` with the devnet queue account (the handler checks its owner and discriminator).
//   series:   TSLAx-5m registered with one Book; a Window listed on the next 5-minute boundary at least 90 s out.
//   pre-open: a PostOnly call rests on the Listed Window; an IOC taker is refused with 6121 (D-088).
//   prints:   live devnet Surge quotes through `public_record_print_switchboard`, one refusal per check in handler order:
//             T + 5 → 6204 (before min_delay_sec); T + 12 as the deployer → 6209 (attestor-only until T + 40); the wrong
//             queue → 6215; as the attestor with the fork's slot two past a fresh quote's → the SlotHashes verdict
//             (6208 or 6218: Surfpool's SlotHashes are synthetic, so no live quote verifies here; LiteSVM
//             `events_switchboard.rs` is the price-verification proof); T + 41 as the deployer with the slot 30 past the
//             quote's → 6218 (the public window admits any recorder; a stale slot is named before anything else).
//   void:     no print lands, so the Window voids past its close deadline; sweep, redeem to the base unit, Book release.
// Run: SURFPOOL_PORT=9063 SURFPOOL_WS_PORT=9064 pnpm drive:token-cycle [--symbol TSLA] [--cadence 300] [--min-oracles 3]

import { writeFileSync } from "node:fs";
import {
  chainNowSec, createDeployClient, ensureBooks, ensureSeries, fundUser, keypairSigner, KIND, newSigner, openWindow, ORDER_TYPE, pinSwitchboardQueue,
  placeOrder, readSeats, recycleBooks, redeem, SWITCHBOARD_DEVNET_QUEUE_ADDRESS, sweepExpired, tokenSeries, voidExpired, WHICH,
  type PriceSources, type SeriesSpec, type StepContext, type StepLog, type VenueRecord,
} from "@agari/markets/deploy";
import { fetchTokenQuote, quoteInstruction, readSwitchboardVenue, recordSwitchboardSlot, type PrintSlot, type SlotOutcome } from "@agari/markets/ops/prints";
import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { arg, endpoints, flag, readJson, redactKey, roleSecret, sol } from "../deploy/ops-cluster";
import { computeUnits, currentSlot, slotTravel, timeTravel, wallSec } from "./sources";

process.on("uncaughtException", (e) => {
  console.error(redactKey(e instanceof Error ? (e.stack ?? e.message) : String(e)));
  process.exit(1);
});
if (flag("--cluster") && !process.argv.includes("localnet")) throw new Error("token-cycle runs on Surfpool only (--cluster localnet)");

/** The mainnet on-demand queue: a real queue, but not the pinned one (prints.md §4.4 step 1). */
const WRONG_QUEUE = "A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w";
const ERROR_NAME: Record<number, string> = {
  6121: "PreOpenTakerRefused", 6204: "PrintTooEarly", 6206: "PrintTooLate", 6208: "BadAttestation", 6209: "UnknownAttestor",
  6215: "SwitchboardQueueMismatch", 6218: "QuoteSlotStale",
};
const STAKE = 5_000_000n;

const symbol = arg("--symbol", "TSLA") as TickerSymbol;
const cadenceSec = Number(arg("--cadence", "300"));
const minOracles = Number(arg("--min-oracles", "3"));
const iso = (sec: number) => new Date(sec * 1000).toISOString().replace(".000", "");
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints("localnet");
const devnet = endpoints("devnet");
const sources = readJson<PriceSources>("services/ops/config/price-sources.json");
type TokenLane = { tokenLane: { tickers: Record<string, { surgeSymbol: string; feedHash: string | null }> } };
const venue = readJson<{ venue: VenueRecord }>("scripts/deploy/addresses.devnet.json").venue; // the fork reads devnet's venue (D-027)
const xstock = TICKERS[symbol].xstock;
if (!xstock) throw new Error(`${symbol} has no xStock token lane`);
const feed = readJson<TokenLane>("services/ops/config/price-sources.json").tokenLane.tickers[xstock.symbol];
if (!feed?.feedHash) throw new Error(`tokenLane.tickers.${xstock.symbol}.feedHash is not pinned (D-053)`);

const evidence: Array<StepLog & { chainSec: number }> = [];
let clockSec = 0;
const log = (entry: StepLog) => {
  evidence.push({ ...entry, chainSec: clockSec });
  console.log(`  ${entry.step.padEnd(18)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(18)} ${entry.signature}` : ""}`);
};
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const attestorClient = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("price-attestor") });
const [roller, faucet] = await Promise.all([keypairSigner(roleSecret("roller")), keypairSigner(roleSecret("faucet-mint-authority"))]);
const record: VenueRecord = structuredClone(venue); // in memory only: a fork is one drive long
const ctx: StepContext = { client, record, save: (next) => Object.assign(record, next), log };
const config = (await client.agariEvents.accounts.globalConfig.fetch(venue.config as never)).data;
const mint = config.collateralMint;
const balance = async (address: string) => (await client.rpc.getBalance(address as never).send()).value;
const tokenAmount = async (address: string) => (await client.token.accounts.token.fetch(address as never)).data.amount;
clockSec = await chainNowSec(client);
const before = await balance(client.payer.address);
console.log(`token drive on ${label}, payer ${client.payer.address}, attestor ${attestorClient.payer.address}, chain clock ${iso(clockSec)}, slot ${await currentSlot(rpcUrl)}`);
if ((await balance(attestorClient.payer.address)) < 1_000_000_000n) throw new Error("price-attestor needs ≥ 1 SOL on the fork (surfpool start -a <its pubkey>)");

/** Surfpool only: jump the chain clock forward to `sec` and read it back. */
async function travel(sec: number, why: string) {
  if (sec > clockSec) await timeTravel(rpcUrl, sec);
  clockSec = await chainNowSec(client);
  if (clockSec < sec) throw new Error(`time travel to ${iso(sec)} left the chain clock at ${iso(clockSec)}`);
  console.log(`  ⏩ ${iso(clockSec)} (${why})`);
}

/** Surfpool only: put the fork's slot `ahead` past a quote's, so the age rule passes or fails by design. */
async function slotJump(quoteSlot: bigint, ahead: bigint, why: string) {
  const was = await currentSlot(rpcUrl);
  const target = quoteSlot + ahead;
  if (BigInt(was) < target) await slotTravel(rpcUrl, target);
  clockSec = await chainNowSec(client);
  console.log(`  ⏩ slot ${was} → ${await currentSlot(rpcUrl)} (quote slot ${quoteSlot} + ${ahead}, ${why}); chain clock ${iso(clockSec)}`);
}

async function expectRefusal(step: string, code: number, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    const text = redactKey(error instanceof Error ? error.message : String(error));
    if (!text.includes(`agari-events ${code}`)) throw new Error(`${step}: expected agari-events ${code}, got:\n${text}`);
    log({ step, signature: null, note: `refused with ${code} ${ERROR_NAME[code]} ✓` });
    return;
  }
  throw new Error(`${step}: UNEXPECTED, the transaction landed`);
}

function expectOutcome(step: string, outcome: SlotOutcome, codes: number[]): number {
  if (outcome.status === "recorded") throw new Error(`${step}: UNEXPECTED, the print landed (${outcome.signature})`);
  const code = outcome.code ?? null;
  const detail = redactKey(outcome.error ?? "").replace(/\s+/g, " ").slice(0, 200);
  if (code === null || !codes.includes(code)) throw new Error(`${step}: expected ${codes.join(" or ")}, got ${code ?? "no engine code"}: ${detail}`);
  log({ step, signature: null, note: `refused with ${code} ${ERROR_NAME[code] ?? ""} ✓ (${detail})` });
  return code;
}

async function liveQuote(what: string) {
  const quote = await fetchTokenQuote({ rpcUrl: devnet.rpcUrl, surgeSymbols: [feed!.surgeSymbol], minOracles, queue: SWITCHBOARD_DEVNET_QUEUE_ADDRESS });
  const value = quote.feeds.find((f) => f.feedHashHex === feed!.feedHash)?.value;
  console.log(`  quote (${what})     devnet slot ${quote.slot}, oracles [${quote.oracleIdxs.join(",")}], ${quoteInstruction(quote).data!.length} B, ${xstock!.symbol} ${value}e-18`);
  return quote;
}

// 1. The pin: the new handler verifies the queue account itself, so the fork's clone of the devnet queue is checked here.
await pinSwitchboardQueue(ctx, SWITCHBOARD_DEVNET_QUEUE_ADDRESS, minOracles);
const pinned = await readSwitchboardVenue(client);
if (pinned.queue !== SWITCHBOARD_DEVNET_QUEUE_ADDRESS || pinned.minOracles !== minOracles) throw new Error(`pin drifted: ${pinned.queue} / ${pinned.minOracles}`);
console.log(`  pin verified       queue ${pinned.queue}, min oracles ${pinned.minOracles}`);

// 2. The Series with one Book (the devnet set has two, D-056), then a Window on the grid at least 90 s out.
const [spec] = tokenSeries(sources, [symbol], [cadenceSec]);
const oneBook: SeriesSpec = { ...spec!, books: { count: 1, capacity: 256 } };
const series = await ensureSeries(ctx, oneBook);
const books = await ensureBooks(ctx, oneBook, series);
const first = await liveQuote("early");
await slotJump(first.slot, 2n, "the fork's slot joins devnet's");
const tradingStartSec = Math.ceil((clockSec + 90) / cadenceSec) * cadenceSec;
const w = await openWindow(ctx, { roller, series, mint, tradingStartSec });
const T = w.expirySec;
console.log(`  window             #${w.index} ${iso(tradingStartSec)} → ${iso(T)}, listed ${tradingStartSec - clockSec} s ahead`);

// 3. D-088 on the runtime: a Listed Window rests PostOnly and refuses a taker.
const maker = await newSigner();
const makerToken = await fundUser(ctx, { faucet, mint, owner: maker.address, amount: STAKE });
await placeOrder(ctx, w, maker, makerToken, { kind: KIND.buyYes, priceTicks: 400, lots: 1_000n, orderType: ORDER_TYPE.postOnly });
const taker = await newSigner();
const takerToken = await fundUser(ctx, { faucet, mint, owner: taker.address, amount: STAKE });
await expectRefusal("pre-open taker", 6121, () => placeOrder(ctx, w, taker, takerToken, { kind: KIND.buyNo, priceTicks: 400, lots: 1_000n, orderType: ORDER_TYPE.ioc }));

// 4. The close print, one refusal per check in handler order (prints.md §4.4).
const slot: PrintSlot = {
  series, market: w.market, seriesKey: oneBook.key, basis: "token", marketIndex: w.index, slot: "close", which: WHICH.close, source: "switchboard",
  boundarySec: T, earliestSec: T + 10, deadlineSec: T + 60, feedIdHex: feed.feedHash, redstoneFeed: null, strictSec: 0, barLenSec: 0,
};
await travel(T + 5, "before T + min_delay_sec");
expectOutcome("print at T + 5", await recordSwitchboardSlot(attestorClient, slot, first, pinned.queue!), [6204]);
await travel(T + 12, "inside [T + 10, T + 60]");
expectOutcome("print as deployer", await recordSwitchboardSlot(client, slot, first, pinned.queue!), [6209]);
expectOutcome("print, wrong queue", await recordSwitchboardSlot(attestorClient, slot, first, WRONG_QUEUE), [6215]);
const fresh = await liveQuote("fresh");
await slotJump(fresh.slot, 2n, "inside max_slot_age, so SlotHashes decides");
const verdict = expectOutcome("print as attestor", await recordSwitchboardSlot(attestorClient, slot, fresh, pinned.queue!), [6208, 6218]);
console.log(`  fork limit         ${verdict === 6208 ? "the fork's SlotHashes carry a synthetic hash for the quote's slot" : "the fork's SlotHashes have no entry for the quote's slot"}: a live quote cannot verify on Surfpool (D-055 amendment)`);
await slotJump(fresh.slot, 30n, "past max_slot_age 20");
await travel(T + 41, "the public recorder window");
expectOutcome("print at T + 41", await recordSwitchboardSlot(client, slot, fresh, pinned.queue!), [6218]);

// 5. No print landed: void past the close deadline, sweep the resting call, redeem to the base unit, release the Book.
await travel(T + 61 + 5, "past the close deadline");
await voidExpired(ctx, w);
const market = (await client.agariEvents.accounts.market.fetch(w.market)).data;
console.log(`  void               state ${market.state}, reason ${market.voidReason}, payout ${market.payoutYes}/${market.payoutNo}`);
await sweepExpired(ctx, w);
const seat = (await readSeats(client, w.ledger)).find((s) => s.owner === maker.address);
if (!seat) throw new Error("the maker has no seat");
await redeem(ctx, w, maker, makerToken, seat.index);
const held = await tokenAmount(makerToken);
if (held !== STAKE) throw new Error(`maker holds ${held} base units after redeem, expected ${STAKE}`);
console.log(`  redeem ✓           maker holds ${held} base units again (escrow and seat bond returned)`);
await recycleBooks(ctx, series, books);

// 6. CU per landed step from the fork's own record.
console.log("\n  step               CU       signature");
for (const e of evidence) if (e.signature) console.log(`  ${e.step.padEnd(18)} ${String((await computeUnits(rpcUrl, e.signature)) ?? "?").padStart(7)}  ${e.signature}`);
const after = await balance(client.payer.address);
console.log(`token drive done at ${iso(wallSec())}: payer spent ${sol(before - after)} SOL, ${evidence.filter((e) => e.signature).length} transactions`);
writeFileSync("scripts/drive/last-run.token.localnet.json", `${JSON.stringify({ cluster: "localnet", evidence }, null, 2)}\n`);
process.exit(0);
