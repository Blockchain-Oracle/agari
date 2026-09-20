/**
 * The S10c drive: supply the reserve, open a boost on a live Window, then take it out every way it can end:
 * the owner's cash-out, a knock-out, a settlement, and the claim of money an exit left owed.
 *
 * Scripts may not import the chain SDKs (plan §6), so the whole drive lives here and `scripts/drive/leverage-boost.ts`
 * passes plain values. The quote it prints before sending is `quoteLeverage` over `boostBookOf`: the same function
 * and the same book walk the web prices from, which follow `owner_open` step for step.
 */
import { findConfigPda } from "@agari/clients/agari-events";
import {
  AGARI_LEVERAGE_PROGRAM_ADDRESS, fetchMaybeLeverageReserve, fetchMaybePosition, fetchMaybeWindowBook, findCustodyPda, findReservePda, findSeatPda,
  getOwnerCloseInstructionAsync, getOwnerOpenInstructionAsync, getProviderSupplyInstructionAsync, getProviderWithdrawInstructionAsync,
  getPublicClaimInstructionAsync, getPublicKnockOutInstructionAsync, getPublicSettleInstructionAsync,
} from "@agari/clients/agari-leverage";
import { isKnockable, knockoutLine, leverageStatusOf, markOverLevels, quoteLeverage } from "@agari/core/leverage";
import type { Side } from "@agari/core/types";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getAddressEncoder, getBase64Encoder, getProgramDerivedAddress, getU64Encoder, type Address } from "@solana/kit";
import { boostBookOf } from "../leverage/book";
import { paramsOf } from "../leverage/reads";
import { decodeBook, findSeat } from "../runtime/decode";
import { send, type SendContext } from "./send";

const text = (seed: string) => new TextEncoder().encode(seed);
const derive = async (seeds: Uint8Array[]) => (await getProgramDerivedAddress({ programAddress: AGARI_LEVERAGE_PROGRAM_ADDRESS, seeds }))[0];
export const leveragePositionAddressOf = (positionId: bigint) => derive([text("position"), getU64Encoder().encode(positionId) as Uint8Array]);
const windowBookOfLeverage = (market: Address) => derive([text("lwin"), getAddressEncoder().encode(market) as Uint8Array]);
const providerOf = (wallet: Address) => derive([text("provider"), getAddressEncoder().encode(wallet) as Uint8Array]);

async function tokenBalance(ctx: SendContext, account: Address): Promise<bigint> {
  const info = await ctx.client.rpc.getAccountInfo(account, { encoding: "base64" }).send();
  if (!info.value) return 0n;
  const bytes = getBase64Encoder().encode(info.value.data[0]);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(64, true);
}

/** The reserve account with custody's balance beside it: every figure the drive prints comes from these two. */
export async function readLeverageReserve(ctx: SendContext) {
  const [reserve] = await findReservePda();
  const [custody] = await findCustodyPda();
  const [seat] = await findSeatPda();
  const account = await fetchMaybeLeverageReserve(ctx.client.rpc, reserve);
  if (!account.exists) throw new Error(`reserve ${reserve} is not initialised: run scripts/deploy/init-leverage.ts`);
  const custodyBase = await tokenBalance(ctx, custody);
  const owed = account.data.userOwedBase;
  const liquidBase = custodyBase > owed ? custodyBase - owed : 0n;
  const open = account.data.open.filter((slot) => slot.positionId !== 0n);
  return { reserve, custody, seat, data: account.data, mint: account.data.collateralMint, custodyBase, liquidBase, totalValueBase: liquidBase + account.data.outstandingBase, open };
}

const ataOf = async (owner: Address, mint: Address) => (await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];

export async function supplyLeverage(ctx: SendContext, amountBase: bigint) {
  const r = await readLeverageReserve(ctx);
  const ix = await getProviderSupplyInstructionAsync({
    provider: ctx.client.payer, position: await providerOf(ctx.client.payer.address), providerToken: await ataOf(ctx.client.payer.address, r.mint),
    collateralMint: r.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS, amountBase,
  });
  const signature = await send(ctx, "supply", [ix], `${amountBase} base units into ${r.custody}`);
  return { signature, after: await readLeverageReserve(ctx) };
}

export async function withdrawLeverage(ctx: SendContext, shares: bigint) {
  const r = await readLeverageReserve(ctx);
  const providerToken = await ataOf(ctx.client.payer.address, r.mint);
  const before = await tokenBalance(ctx, providerToken);
  const ix = await getProviderWithdrawInstructionAsync({
    provider: ctx.client.payer, position: await providerOf(ctx.client.payer.address), providerToken,
    collateralMint: r.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS, shares,
  });
  const signature = await send(ctx, "withdraw", [ix], `${shares} shares out of ${r.custody}`);
  return { signature, receivedBase: (await tokenBalance(ctx, providerToken)) - before, after: await readLeverageReserve(ctx) };
}

/** One Window as the reserve sees it right now: its clock, whether it carries the reserve's seat, and both sides of its book. */
async function windowOf(ctx: SendContext, marketId: Address, side: Side) {
  const market = await ctx.client.agariEvents.accounts.market.fetch(marketId);
  const series = await ctx.client.agariEvents.accounts.series.fetch(market.data.series);
  const [bookInfo, ledgerInfo, [seat]] = await Promise.all([
    ctx.client.rpc.getAccountInfo(market.data.book, { encoding: "base64", commitment: "confirmed" }).send(),
    ctx.client.rpc.getAccountInfo(market.data.ledger, { encoding: "base64", commitment: "confirmed" }).send(),
    findSeatPda(),
  ]);
  const nowSec = Math.floor(Date.now() / 1000);
  const now = BigInt(nowSec);
  const status = market.data.state !== 0 ? "terminal" : now < market.data.tradingStart ? "listed" : now < market.data.lockAt ? "trading" : "locked";
  // A settled Window's Book is recycled, so there may be nothing to walk; an exit by settlement does not need it.
  const book = bookInfo.value ? decodeBook(market.data.book, getBase64Encoder().encode(bookInfo.value.data[0]), bookInfo.context.slot) : null;
  const live = book !== null && book.market === marketId;
  const levels = live
    ? boostBookOf({ book, tickBase: series.data.tickBase, lotBase: series.data.lotBase, minLots: series.data.minLots, minRestSlots: BigInt(series.data.minRestSlots), expirySec: Number(market.data.expiry), nowSec }, side)
    : null;
  const [eventsConfig] = await findConfigPda();
  return {
    status,
    state: market.data.state,
    secondsToLock: Number(market.data.lockAt - now),
    secondsToExpiry: Number(market.data.expiry - now),
    seated: ledgerInfo.value ? findSeat(getBase64Encoder().encode(ledgerInfo.value.data[0]), seat) !== null : false,
    levels,
    nowSec,
    accounts: { series: market.data.series, market: marketId, book: market.data.book, ledger: market.data.ledger, mvault: market.data.mvault, eventsConfig },
  };
}

export interface BoostSpec {
  marketId: Address;
  side: Side;
  stakeBase: bigint;
  leverageBps: number;
}

/** What `owner_open` would do with this stake right now, and why not when it would refuse. Sends nothing. */
export async function probeLeverage(ctx: SendContext, spec: BoostSpec) {
  const [r, w] = await Promise.all([readLeverageReserve(ctx), windowOf(ctx, spec.marketId, spec.side)]);
  const windowBook = await fetchMaybeWindowBook(ctx.client.rpc, await windowBookOfLeverage(spec.marketId));
  const quote = w.levels
    ? quoteLeverage({
        side: spec.side, stakeBase: spec.stakeBase, leverageBps: spec.leverageBps,
        entry: w.levels.entry, exitRested: w.levels.exitRested, one: w.levels.one, lotRaw: w.levels.lotRaw, minQuantityRaw: w.levels.minQuantityRaw,
        params: paramsOf(r.data.params),
        books: { liquidBase: r.liquidBase, outstandingBase: r.data.outstandingBase, windowFrontedBase: windowBook.exists ? windowBook.data.frontedBase : 0n, openPositions: r.open.length },
        expirySec: w.levels.expirySec, nowSec: w.nowSec, decimals: w.levels.decimals, nowMs: Date.now(),
      })
    : null;
  return { reserve: r, window: w, quote };
}

/** Opens the boost the probe quoted, guarded at `floorBps` of the quoted size, and reads the position back. */
export async function openLeverage(ctx: SendContext, spec: BoostSpec, floorBps = 9_500) {
  const { reserve: r, window: w, quote } = await probeLeverage(ctx, spec);
  if (!w.seated) throw new Error(`Window ${spec.marketId} carries no seat for the reserve: it opened before the seat was registered`);
  if (!quote || !w.levels) throw new Error(`Window ${spec.marketId} has no live Book`);
  if (!quote.ok) return { quote, signature: null, positionId: null, position: null };
  const positionId = r.data.nextPositionId;
  const position = await leveragePositionAddressOf(positionId);
  const ownerToken = await ataOf(ctx.client.payer.address, r.mint);
  const before = await tokenBalance(ctx, ownerToken);
  const ix = await getOwnerOpenInstructionAsync({
    owner: ctx.client.payer, position, window: await windowBookOfLeverage(spec.marketId), ownerToken, ...w.accounts,
    collateralMint: r.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS,
    outcome: spec.side === "up" ? 0 : 1, stakeBase: spec.stakeBase, leverageBps: spec.leverageBps,
    minLots: ((quote.quote.quantityRaw * BigInt(floorBps)) / 10_000n) / w.levels.lotRaw,
  });
  const signature = await send(ctx, "open", [ix], `${spec.leverageBps / 10_000}x ${spec.side} on ${spec.marketId} with ${spec.stakeBase} staked`);
  const booked = await fetchMaybePosition(ctx.client.rpc, position);
  return { quote, signature, positionId, position: booked.exists ? booked.data : null, paidBase: before - (await tokenBalance(ctx, ownerToken)) };
}

/** A position with its mark taken the way the chain takes it: the whole position over rested depth. */
export async function readLeveragePosition(ctx: SendContext, positionId: bigint) {
  const address = await leveragePositionAddressOf(positionId);
  const account = await fetchMaybePosition(ctx.client.rpc, address);
  if (!account.exists) throw new Error(`no position ${positionId} at ${address}`);
  const p = account.data;
  const side: Side = p.outcome === 0 ? "up" : "down";
  const [r, w] = await Promise.all([readLeverageReserve(ctx), windowOf(ctx, p.market, side)]);
  const quantityRaw = p.lots * p.lotBase;
  const maintenanceBps = r.data.params.maintenanceBps;
  const mark = w.levels ? markOverLevels(w.levels.exitRested, side === "down", w.levels.one, quantityRaw) : null;
  const resting = w.levels ? markOverLevels(w.levels.exitResting, side === "down", w.levels.one, quantityRaw) : null;
  return {
    address, data: p, side, status: leverageStatusOf(Number(p.status)), quantityRaw, window: w, reserve: r,
    lineBase: knockoutLine(p.frontedBase, maintenanceBps),
    mark, resting,
    knockable: mark !== null && mark.filledRaw >= quantityRaw && isKnockable(mark.markBase, p.frontedBase, maintenanceBps),
  };
}

type Exit = "close" | "knock-out" | "settle";

/**
 * One exit. `payOwner` false leaves the owner's token account out of a permissionless exit on purpose, so the
 * money is left owed and `claimLeverage` has something to pay: the path D-114 exists for.
 */
export async function exitLeverage(ctx: SendContext, positionId: bigint, how: Exit, options: { minProceedsBase?: bigint; payOwner?: boolean } = {}) {
  const p = await readLeveragePosition(ctx, positionId);
  const r = p.reserve;
  const ownerToken = await ataOf(p.data.owner, r.mint);
  const before = await tokenBalance(ctx, ownerToken);
  const shared = { caller: ctx.client.payer, position: p.address, window: await windowBookOfLeverage(p.data.market), collateralMint: r.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS };
  const pay = options.payOwner === false ? {} : { ownerToken };
  const { book: _book, ...noBook } = p.window.accounts;
  const ix = how === "close"
    ? await getOwnerCloseInstructionAsync({ ...shared, ...p.window.accounts, ownerToken, minProceedsBase: options.minProceedsBase ?? 0n })
    : how === "knock-out"
      ? await getPublicKnockOutInstructionAsync({ ...shared, ...p.window.accounts, ...pay })
      : await getPublicSettleInstructionAsync({ ...shared, ...noBook, ...pay });
  const signature = await send(ctx, how, [ix], `position ${positionId} (${p.status}, ${p.quantityRaw} raw, fronted ${p.data.frontedBase})`);
  const after = await fetchMaybePosition(ctx.client.rpc, p.address);
  return { signature, before: p, after: after.exists ? after.data : null, ownerReceivedBase: (await tokenBalance(ctx, ownerToken)) - before, reserveAfter: await readLeverageReserve(ctx) };
}

/** Pays what an exit left owed. Anyone may send it; the money only ever goes to the position's owner. */
export async function claimLeverage(ctx: SendContext, positionId: bigint) {
  const address = await leveragePositionAddressOf(positionId);
  const account = await fetchMaybePosition(ctx.client.rpc, address);
  if (!account.exists) throw new Error(`no position ${positionId}`);
  const r = await readLeverageReserve(ctx);
  const ownerToken = await ataOf(account.data.owner, r.mint);
  const before = await tokenBalance(ctx, ownerToken);
  const create = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: ctx.client.payer, owner: account.data.owner, mint: r.mint });
  const ix = await getPublicClaimInstructionAsync({ caller: ctx.client.payer, position: address, ownerToken, collateralMint: r.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const signature = await send(ctx, "claim", [create, ix], `position ${positionId} owes ${account.data.owedBase}`);
  return { signature, owedBase: account.data.owedBase, ownerReceivedBase: (await tokenBalance(ctx, ownerToken)) - before, reserveAfter: await readLeverageReserve(ctx) };
}
