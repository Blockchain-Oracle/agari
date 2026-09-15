/**
 * The seed maker's instructions (venue-ops.md §8). The maker key is authority and fee payer; cash moves between its
 * tUSDC ATA and the Window's mvault. Builders only: the actor sends with `sendOps`.
 */
import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  getUserCancelAllInstructionAsync,
  getUserMergeCompleteSetInstructionAsync,
  getUserPlaceOrderInstructionAsync,
  getUserWithdrawCreditInstructionAsync,
} from "@agari/clients/agari-events";
import { getBase64Encoder, type Address, type Instruction, type Signature } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { eventAuthority } from "../../deploy/cycle/accounts";
import type { OpsClient } from "../client";
import type { VenueConfig } from "../settle/reads";
import type { MarketView } from "../venue";

const program = AGARI_EVENTS_PROGRAM_ADDRESS;

export const MAKER_KIND = { buyYes: 0, buyNo: 2 } as const;
/** `order_type`: a PostOnly quote only rests; a Normal (limit) quote also takes what already rests on its side (D-090). */
export const POST_ONLY = 3;
export const NORMAL = 0;
/** A taker meeting its own resting order cancels that maker order instead of reverting (`SelfMatch::CancelMaker`). */
export const SELF_MATCH_CANCEL_MAKER = 1;
/** Fills one crossing quote may take; a Normal order that stops on the cap cancels its remainder (events-engine.md §3.2). */
export const QUOTE_MAX_FILLS = 16;
/** `seat_hint = u16::MAX`: only for an authority without a seat on this Ledger (D-020). */
export const ANY_SEAT = 0xffff;

export async function makerTokenAccount(owner: Address, mint: Address): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

/** Base units in a token account, or null when it doesn't exist. */
export async function tokenBalance(client: OpsClient, account: Address): Promise<bigint | null> {
  const info = await client.rpc.getAccountInfo(account, { encoding: "base64", dataSlice: { offset: 64, length: 8 } }).send();
  if (!info.value) return null;
  const bytes = getBase64Encoder().encode(info.value.data[0]);
  return new DataView(bytes.buffer, bytes.byteOffset, 8).getBigUint64(0, true);
}

export type QuoteInput = { kind: number; priceTicks: number; lots: bigint; expireSec: number; seatHint: number; clientId: bigint; orderType?: number };

/**
 * One quote placement; `use_credit` spends the seat's credit first, so proceeds recycle into the next quote.
 * PostOnly only rests (one fill would be a cross, which the engine refuses). Normal takes any resting order on its side
 * at that order's price, so a bell quote fills the pre-open calls users rested on a prelisted Window (D-089, D-090).
 */
export async function quoteInstruction(client: OpsClient, m: MarketView, config: VenueConfig, order: QuoteInput): Promise<Instruction> {
  const orderType = order.orderType ?? POST_ONLY;
  const crossing = orderType === NORMAL;
  return getUserPlaceOrderInstructionAsync({
    authority: client.payer, config: config.address, series: m.data.series, market: m.address, book: m.data.book, ledger: m.data.ledger,
    mvault: m.data.mvault, authorityToken: await makerTokenAccount(client.payer.address, config.collateralMint), collateralMint: config.collateralMint,
    eventAuthority: await eventAuthority(), program,
    kind: order.kind, priceTicks: order.priceTicks, lots: order.lots, expireTs: order.expireSec, orderType,
    selfMatch: crossing ? SELF_MATCH_CANCEL_MAKER : 0, maxFills: crossing ? QUOTE_MAX_FILLS : 1, maxEvictions: 16,
    seatHint: order.seatHint, useCredit: true, withdrawProceeds: false, clientId: order.clientId,
  });
}

/** What one placement did, from `PlaceResult` (the engine's return data, the `OrderExecuted` numbers; events-accounts.md §5). */
export type PlaceOutcome = { filledLots: bigint; restedLots: bigint; cancelledLots: bigint; stopReason: number };

const PLACE_RESULT_LEN = 91;

/** Decodes `PlaceResult` from a confirmed transaction's return data; null when the RPC kept none (treat as "nothing rests"). */
export async function readPlaceOutcome(client: OpsClient, signature: string): Promise<PlaceOutcome | null> {
  const tx = (await client.rpc
    .getTransaction(signature as Signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 })
    .send()) as { meta?: { returnData?: { data?: readonly [string, string] } | null } | null } | null;
  const base64 = tx?.meta?.returnData?.data?.[0];
  if (!base64) return null;
  const bytes = getBase64Encoder().encode(base64);
  if (bytes.length < PLACE_RESULT_LEN) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  // Borsh, little-endian: filled, cash_spent, cash_received, credit_used, transferred_in, withdrawn, refunded, rested, cancelled …
  return { filledLots: view.getBigUint64(0, true), restedLots: view.getBigUint64(56, true), cancelledLots: view.getBigUint64(64, true), stopReason: view.getUint8(89) };
}

/** Cancels every resting order of the seat; `withdraw` sweeps the refunded escrow and credit to the ATA. */
export async function cancelAllInstruction(client: OpsClient, m: MarketView, config: VenueConfig, seatIdx: number, withdraw: boolean): Promise<Instruction> {
  return getUserCancelAllInstructionAsync({
    authority: client.payer, config: config.address, series: m.data.series, market: m.address, book: m.data.book, ledger: m.data.ledger,
    mvault: m.data.mvault, authorityToken: await makerTokenAccount(client.payer.address, config.collateralMint), collateralMint: config.collateralMint,
    eventAuthority: await eventAuthority(), program, seatIdx, maxScan: 64, withdraw,
  });
}

export async function mergeSetInstruction(client: OpsClient, m: MarketView, config: VenueConfig, seatIdx: number, lots: bigint): Promise<Instruction> {
  return getUserMergeCompleteSetInstructionAsync({
    authority: client.payer, config: config.address, series: m.data.series, market: m.address, ledger: m.data.ledger, mvault: m.data.mvault,
    authorityToken: await makerTokenAccount(client.payer.address, config.collateralMint), collateralMint: config.collateralMint,
    eventAuthority: await eventAuthority(), program, lots, seatIdx, withdraw: true,
  });
}

export async function withdrawCreditInstruction(client: OpsClient, m: MarketView, config: VenueConfig, seatIdx: number, amount: bigint): Promise<Instruction> {
  return getUserWithdrawCreditInstructionAsync({
    authority: client.payer, config: config.address, market: m.address, ledger: m.data.ledger, mvault: m.data.mvault,
    authorityToken: await makerTokenAccount(client.payer.address, config.collateralMint), collateralMint: config.collateralMint,
    eventAuthority: await eventAuthority(), program, seatIdx, amount,
  });
}
