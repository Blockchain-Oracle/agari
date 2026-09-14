/** Opening a Window (roller), funding a user with tUSDC (faucet) and placing orders. */
import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  getRollerOpenWindowInstructionAsync,
  getUserPlaceOrderInstructionAsync,
  type UserPlaceOrderInstructionDataArgs,
} from "@agari/clients/agari-events";
import { generateKeyPairSigner, type Address, type KeyPairSigner } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { send, type SendContext } from "../send";
import { COLLATERAL_DECIMALS } from "../venue-spec";
import { coveringVersion, eventAuthority, readSeats, windowAddresses, type WindowAddresses } from "./accounts";

export type OpenedWindow = WindowAddresses & {
  book: Address;
  mint: Address;
  tradingStartSec: number;
  expirySec: number;
  policyVersion: number;
  signature: string;
};

export const KIND = { buyYes: 0, sellYes: 1, buyNo: 2, sellNo: 3 } as const;
export const ORDER_TYPE = { normal: 0, fok: 1, ioc: 2, postOnly: 3 } as const;
/** A throwaway drive user (never persisted). */
export const newSigner = generateKeyPairSigner;

/** `seat_hint = u16::MAX`: the first empty seat, or the authority's own. */
export const ANY_SEAT = 0xffff;

/** A clock-aligned Regular Window `[tradingStart, tradingStart + cadence]` on the next index and a free Book. */
export async function openWindow(
  ctx: SendContext,
  input: { roller: KeyPairSigner; series: Address; mint: Address; tradingStartSec: number },
): Promise<OpenedWindow> {
  const series = await ctx.client.agariEvents.accounts.series.fetch(input.series);
  const tradingStart = input.tradingStartSec;
  const expiry = tradingStart + series.data.cadenceSec;
  if (tradingStart % series.data.cadenceSec !== 0) throw new Error(`${tradingStart} is not on the ${series.data.cadenceSec} s grid`);
  const policyVersion = coveringVersion(series.data, tradingStart, expiry);
  if (policyVersion === null) throw new Error(`no policy version covers ${tradingStart}..${expiry}: the Window is not listed`);
  const book = series.data.freeBooks[0];
  if (series.data.freeBookCount === 0 || !book) throw new Error(`Series ${input.series} has no free Book`);
  const w = await windowAddresses(input.series, series.data.nextIndex);
  const ix = await getRollerOpenWindowInstructionAsync({
    roller: input.roller,
    payer: ctx.client.payer,
    series: input.series,
    market: w.market,
    book,
    collateralMint: input.mint,
    eventAuthority: await eventAuthority(),
    program: AGARI_EVENTS_PROGRAM_ADDRESS,
    index: w.index,
    tradingStart,
    lockAt: expiry,
    expiry,
    policyVersion,
    openKind: 0,
    closeKind: 0,
  });
  const signature = await send(ctx, "open window", [ix], `#${w.index} ${new Date(tradingStart * 1000).toISOString()} → market ${w.market}, v${policyVersion + 1}, book ${book}`);
  return { ...w, book, mint: input.mint, tradingStartSec: tradingStart, expirySec: expiry, policyVersion, signature };
}

/** Mints `amount` base units of tUSDC to `owner`'s ATA (created if missing) with the faucet authority. */
export async function fundUser(ctx: SendContext, input: { faucet: KeyPairSigner; mint: Address; owner: Address; amount: bigint }): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({ owner: input.owner, mint: input.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const result = await ctx.client.token.instructions
    .mintToATA({ ata, owner: input.owner, mint: input.mint, mintAuthority: input.faucet, amount: input.amount, decimals: COLLATERAL_DECIMALS })
    .sendTransaction();
  ctx.log({ step: "fund user", signature: String(result.context.signature), note: `${input.amount} base units → ${input.owner}` });
  return ata;
}

export type OrderInput = Pick<UserPlaceOrderInstructionDataArgs, "kind" | "priceTicks" | "lots" | "orderType"> &
  Partial<Omit<UserPlaceOrderInstructionDataArgs, "kind" | "priceTicks" | "lots" | "orderType">>;

/** An authority that already holds a seat must name it; `ANY_SEAT` is refused with `SeatMismatch` (D-020). */
export async function seatHintFor(ctx: SendContext, w: OpenedWindow, authority: Address): Promise<number> {
  const seat = (await readSeats(ctx.client, w.ledger)).find((s) => s.owner === authority);
  return seat ? seat.index : ANY_SEAT;
}

export async function placeOrderInstruction(ctx: SendContext, w: OpenedWindow, user: KeyPairSigner, userToken: Address, order: OrderInput) {
  const seatHint = order.seatHint ?? (await seatHintFor(ctx, w, user.address));
  return getUserPlaceOrderInstructionAsync({
    authority: user,
    series: w.series,
    market: w.market,
    book: w.book,
    ledger: w.ledger,
    mvault: w.mvault,
    authorityToken: userToken,
    collateralMint: w.mint,
    eventAuthority: await eventAuthority(),
    program: AGARI_EVENTS_PROGRAM_ADDRESS,
    expireTs: w.expirySec,
    selfMatch: 0,
    maxFills: 16,
    maxEvictions: 16,
    useCredit: false,
    withdrawProceeds: false,
    clientId: 0,
    ...order,
    seatHint,
  });
}

export async function placeOrder(ctx: SendContext, w: OpenedWindow, user: KeyPairSigner, userToken: Address, order: OrderInput): Promise<string> {
  const ix = await placeOrderInstruction(ctx, w, user, userToken, order);
  const kind = Object.entries(KIND).find(([, v]) => v === order.kind)?.[0];
  return send(ctx, "place order", [ix], `${user.address.slice(0, 6)} ${kind} ${order.lots} @ ${order.priceTicks}`);
}
