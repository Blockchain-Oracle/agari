/**
 * A Window the drive owns end to end, on drive-only Series 903: an attested primary and no check, 15 minutes long.
 *
 * A product that holds positions across a settlement (the leverage reserve, and whatever comes after it) has to be
 * proven at every ending: sold into a bid, knocked out under a line, paid on a win, written off on a loss. On a live
 * lane the book belongs to the maker and the print to the market, so a drive there proves whichever ending the day
 * happens to offer, and at a weekend it proves none. Here the drive rests both sides of the book and attests both
 * prints, so each ending is reached on purpose. Series 903 is never in the core ticker registry, so no app surface
 * lists it (D-027).
 */
import { AGARI_EVENTS_PROGRAM_ADDRESS, getUserCancelAllInstructionAsync } from "@agari/clients/agari-events";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address, KeyPairSigner } from "@solana/kit";
import { chainNowSec, eventAuthority, readSeats } from "./cycle/accounts";
import { recordAttestedPrint, recycleBooks, settleWindow, WHICH } from "./cycle/resolve";
import { fundUser, KIND, openWindow, ORDER_TYPE, placeOrder, type OpenedWindow } from "./cycle/window";
import { ensureBooks, ensureSeries } from "./ensure-series";
import { asciiFeedId, I64_MAX, policyVersions, SOURCE, ZERO_POLICY, type PriceSources } from "./policies";
import { send, type SendContext, type StepContext } from "./send";
import { BASIS, LAUNCH_GRID, type SeriesSpec } from "./venue-spec";

export const DRIVE_OWNED_TICKER = 903;
export const DRIVE_OWNED_FEED = asciiFeedId("agari-drive-attested:owned");
const CADENCE_SEC = 900;
const BAR_LEN_SEC = 60;
const MIN_DELAY_SEC = 10;
/** A Window is opened on the running boundary only this soon after it; later, the drive waits for the next one. */
const LATEST_START_AFTER_SEC = 120;

export function driveOwnedSeries(sources: PriceSources): SeriesSpec {
  const tsla = policyVersions("TSLA", sources)[0]!;
  const primary = { ...ZERO_POLICY, source: SOURCE.attested, feedId: DRIVE_OWNED_FEED, minDelaySec: MIN_DELAY_SEC, barLenSec: BAR_LEN_SEC, openAdmissionSec: 900, closeAdmissionSec: 900 };
  return {
    key: "TEST-OWNED-15m", symbol: "TSLA", ticker: DRIVE_OWNED_TICKER, cadenceSec: CADENCE_SEC, basis: BASIS.regular, params: LAUNCH_GRID,
    versions: [{ validFromTs: tsla.validFromTs, validUntilTs: I64_MAX, primary, check: ZERO_POLICY, maxDivergenceBps: 0, checkAdmissionSec: 0 }],
    books: { count: 1, capacity: 256 },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForChain(ctx: SendContext, sec: number, why: string): Promise<number> {
  let now = await chainNowSec(ctx.client);
  if (now < sec) ctx.log({ step: "wait", signature: null, note: `${sec - now}s for ${why}` });
  while (now < sec) {
    await sleep(Math.min(5_000, (sec - now) * 1_000));
    now = await chainNowSec(ctx.client);
  }
  return now;
}

export interface OwnedWindowKeys {
  roller: KeyPairSigner;
  attestor: KeyPairSigner;
  clusterTag: number;
  mint: Address;
}

/** Ensures the Series and its Book, opens the Window on the running or the next 15-minute boundary, and attests its opening print. */
export async function openOwnedWindow(ctx: StepContext, keys: OwnedWindowKeys, sources: PriceSources, openPriceE8: bigint): Promise<OpenedWindow> {
  const spec = driveOwnedSeries(sources);
  const series = await ensureSeries(ctx, spec);
  const books = await ensureBooks(ctx, spec, series);
  await recycleBooks(ctx, series, books);
  const now = await chainNowSec(ctx.client);
  const running = Math.floor(now / CADENCE_SEC) * CADENCE_SEC;
  const tradingStartSec = now - running <= LATEST_START_AFTER_SEC ? running : running + CADENCE_SEC;
  const w = await openWindow(ctx, { roller: keys.roller, series, mint: keys.mint, tradingStartSec });
  const fetchedAtTs = await waitForChain(ctx, tradingStartSec + MIN_DELAY_SEC, "the opening print's correction delay");
  await recordAttestedPrint(ctx, w, { attestor: keys.attestor, clusterTag: keys.clusterTag, which: WHICH.open, boundaryTs: tradingStartSec, price: openPriceE8, feedId: DRIVE_OWNED_FEED, barLenSec: BAR_LEN_SEC, fetchedAtTs });
  return w;
}

/** The same Window rebuilt from its Market, so a later invocation can act on one an earlier invocation opened. */
export async function ownedWindowOf(ctx: SendContext, marketId: Address, mint: Address): Promise<OpenedWindow> {
  const { data } = await ctx.client.agariEvents.accounts.market.fetch(marketId);
  return {
    series: data.series, index: data.index, market: marketId, ledger: data.ledger, mvault: data.mvault, book: data.book, mint,
    tradingStartSec: Number(data.tradingStart), expirySec: Number(data.expiry), policyVersion: data.policyVersion, signature: "",
  };
}

export interface OwnedQuote {
  bidTicks: number;
  askTicks: number;
  lots: bigint;
}

/**
 * Both sides of the book, from two wallets so they never self-match: a YES bid, and an ask rested as BUY_NO at the
 * same YES price (every engine price is a YES price). Whatever either wallet had resting is cancelled first, so
 * calling this again moves the market. Rested orders count for the reserve only after the Series' `min_rest_slots`.
 */
export async function quoteOwnedWindow(ctx: SendContext, w: OpenedWindow, makers: { bidder: KeyPairSigner; asker: KeyPairSigner; faucet: KeyPairSigner }, quote: OwnedQuote) {
  const seats = await readSeats(ctx.client, w.ledger);
  for (const maker of [makers.bidder, makers.asker]) {
    const seat = seats.find((s) => s.owner === maker.address);
    if (!seat) continue;
    const [authorityToken] = await findAssociatedTokenPda({ owner: maker.address, mint: w.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const ix = await getUserCancelAllInstructionAsync({
      authority: maker, series: w.series, market: w.market, book: w.book, ledger: w.ledger, mvault: w.mvault, authorityToken, collateralMint: w.mint,
      eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS, seatIdx: seat.index, maxScan: 64, withdraw: false,
    });
    await send(ctx, "cancel all", [ix], `${maker.address.slice(0, 6)} seat ${seat.index}`);
  }
  // Each side escrows its own price for every lot; a little over covers the seat bond and rounding.
  const lotBase = (await ctx.client.agariEvents.accounts.series.fetch(w.series)).data.lotBase;
  const need = (ticks: number) => (quote.lots * lotBase * BigInt(ticks)) / 1_000n + 2_000_000n;
  const bidToken = await fundUser(ctx, { faucet: makers.faucet, mint: w.mint, owner: makers.bidder.address, amount: need(quote.bidTicks) });
  const askToken = await fundUser(ctx, { faucet: makers.faucet, mint: w.mint, owner: makers.asker.address, amount: need(1_000 - quote.askTicks) });
  const bid = await placeOrder(ctx, w, makers.bidder, bidToken, { kind: KIND.buyYes, priceTicks: quote.bidTicks, lots: quote.lots, orderType: ORDER_TYPE.postOnly });
  const ask = await placeOrder(ctx, w, makers.asker, askToken, { kind: KIND.buyNo, priceTicks: quote.askTicks, lots: quote.lots, orderType: ORDER_TYPE.postOnly });
  return { bid, ask };
}

/** Attests the closing print once its correction delay has passed, then settles the Window. */
export async function closeOwnedWindow(ctx: SendContext, w: OpenedWindow, keys: Pick<OwnedWindowKeys, "attestor" | "clusterTag">, closePriceE8: bigint) {
  const fetchedAtTs = await waitForChain(ctx, w.expirySec + MIN_DELAY_SEC, "the closing print's correction delay");
  const print = await recordAttestedPrint(ctx, w, { attestor: keys.attestor, clusterTag: keys.clusterTag, which: WHICH.close, boundaryTs: w.expirySec, price: closePriceE8, feedId: DRIVE_OWNED_FEED, barLenSec: BAR_LEN_SEC, fetchedAtTs });
  const settle = await settleWindow(ctx, w);
  const { data } = await ctx.client.agariEvents.accounts.market.fetch(w.market);
  return { print, settle, state: data.state, payoutYes: data.payoutYes, payoutNo: data.payoutNo, voidReason: data.voidReason };
}
