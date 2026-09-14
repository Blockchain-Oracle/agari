/** Prints (Pyth, RedStone, attested), settle or void, sweep and redeem for one Window. */
import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  findConfigPda,
  getPublicRecordPrintAttestedInstructionAsync,
  getPublicRecordPrintPythInstruction,
  getPublicRecordPrintRedstoneInstructionAsync,
  getPublicReleaseBookInstruction,
  getPublicSettleWindowInstructionAsync,
  getPublicSweepExpiredInstruction,
  getPublicVoidExpiredInstructionAsync,
  getUserRedeemInstructionAsync,
} from "@agari/clients/agari-events";
import type { Address, KeyPairSigner } from "@solana/kit";
import { DEFAULT_ADDRESS } from "../venue-spec";
import { attestedMessage, ed25519Instruction } from "../../prices/attested";
import { send, type SendContext } from "../send";
import { chainNowSec, eventAuthority } from "./accounts";
import type { OpenedWindow } from "./window";

export const WHICH = { open: 0, close: 1, checkOpen: 2, checkClose: 3 } as const;
const WHICH_NAME = ["open", "close", "check open", "check close"];

export async function recordPythPrint(ctx: SendContext, w: OpenedWindow, which: number, priceUpdate: Address): Promise<string> {
  const ix = getPublicRecordPrintPythInstruction({
    series: w.series, market: w.market, priceUpdate, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS, which,
  });
  return send(ctx, `pyth ${WHICH_NAME[which]}`, [ix], `update ${priceUpdate}`);
}

export async function recordRedstonePrint(ctx: SendContext, w: OpenedWindow, which: number, payload: Uint8Array, signers: number): Promise<string> {
  const ix = await getPublicRecordPrintRedstoneInstructionAsync({
    series: w.series, market: w.market, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS, which, payload,
  });
  return send(ctx, `redstone ${WHICH_NAME[which]}`, [ix], `${signers} packages, ${payload.length} B payload`);
}

export type AttestedInput = {
  attestor: KeyPairSigner;
  clusterTag: number;
  which: number;
  boundaryTs: number;
  price: bigint;
  feedId: Uint8Array;
  barLenSec: number;
  fetchedAtTs: number;
};

/** `[ed25519 over the 158 B message, public_record_print_attested]` in one transaction, the precompile first. */
export async function recordAttestedPrint(ctx: SendContext, w: OpenedWindow, a: AttestedInput): Promise<string> {
  const expo = -8;
  const message = attestedMessage({
    programId: AGARI_EVENTS_PROGRAM_ADDRESS, clusterTag: a.clusterTag, market: w.market, which: a.which, boundaryTs: BigInt(a.boundaryTs),
    price: a.price, expo, feedId: a.feedId, barLenSec: a.barLenSec, fetchedAtTs: BigInt(a.fetchedAtTs),
  });
  // Offsets name `u16::MAX` ("this instruction"), so the pair stays valid wherever the planner puts its compute-budget
  // instruction; the program only needs the precompile immediately before the record (§4.3 steps 4–5).
  const verify = await ed25519Instruction(a.attestor, message, 0xffff);
  const record = await getPublicRecordPrintAttestedInstructionAsync({
    series: w.series, market: w.market, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS,
    which: a.which, price: a.price, expo, barStartTs: BigInt(a.boundaryTs - a.barLenSec), fetchedAtTs: BigInt(a.fetchedAtTs),
  });
  return send(ctx, `attested ${WHICH_NAME[a.which]}`, [verify, record], `price ${a.price} e-8 by ${a.attestor.address.slice(0, 6)}`);
}

export async function settleWindow(ctx: SendContext, w: OpenedWindow): Promise<string> {
  const ix = await getPublicSettleWindowInstructionAsync({
    payer: ctx.client.payer, series: w.series, market: w.market, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS,
  });
  return send(ctx, "settle", [ix], `market ${w.market}`);
}

export async function voidExpired(ctx: SendContext, w: OpenedWindow): Promise<string> {
  const ix = await getPublicVoidExpiredInstructionAsync({
    payer: ctx.client.payer, series: w.series, market: w.market, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS,
  });
  return send(ctx, "void expired", [ix], `market ${w.market}`);
}

export async function sweepExpired(ctx: SendContext, w: OpenedWindow, max = 32): Promise<string> {
  const ix = getPublicSweepExpiredInstruction({
    series: w.series, market: w.market, book: w.book, ledger: w.ledger, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS, max,
  });
  return send(ctx, "sweep", [ix], `up to ${max} orders`);
}

export async function redeem(ctx: SendContext, w: OpenedWindow, user: KeyPairSigner, userToken: Address, seatIdx: number): Promise<string> {
  const [config] = await findConfigPda();
  const ix = await getUserRedeemInstructionAsync({
    authority: user, config, series: w.series, market: w.market, ledger: w.ledger, mvault: w.mvault, authorityToken: userToken,
    collateralMint: w.mint, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS, seatIdx, outcome: null, lots: null,
  });
  return send(ctx, "redeem", [ix], `seat ${seatIdx} → ${user.address.slice(0, 6)}`);
}

/**
 * Returns every Book of a Series whose Window has locked to the free list (`public_sweep_expired` first, so the Book
 * is empty), and reports what it couldn't release. A Book bound to a still-trading Window stays bound.
 */
export async function recycleBooks(ctx: SendContext, series: Address, books: Address[]): Promise<number> {
  const nowSec = await chainNowSec(ctx.client);
  let released = 0;
  for (const account of await ctx.client.agariEvents.accounts.book.fetchAll(books)) {
    const market = account.data.market;
    if (market === DEFAULT_ADDRESS) continue;
    const m = (await ctx.client.agariEvents.accounts.market.fetch(market)).data;
    if (m.state === 0 && nowSec < Number(m.lockAt)) continue;
    const w = { series, market, book: account.address, ledger: m.ledger } as OpenedWindow;
    if (account.data.orderCount > 0) await sweepExpired(ctx, w);
    const ix = getPublicReleaseBookInstruction({ series, market, book: account.address, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS });
    await send(ctx, "release book", [ix], `${account.address} from market ${market}`);
    released++;
  }
  return released;
}
