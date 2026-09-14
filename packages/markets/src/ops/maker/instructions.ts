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
import { getBase64Encoder, type Address, type Instruction } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { eventAuthority } from "../../deploy/cycle/accounts";
import type { OpsClient } from "../client";
import type { VenueConfig } from "../settle/reads";
import type { MarketView } from "../venue";

const program = AGARI_EVENTS_PROGRAM_ADDRESS;

export const MAKER_KIND = { buyYes: 0, buyNo: 2 } as const;
export const POST_ONLY = 3;
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

export type PostOnlyInput = { kind: number; priceTicks: number; lots: bigint; expireSec: number; seatHint: number; clientId: bigint };

/** A PostOnly placement; `use_credit` spends the seat's credit first, so proceeds recycle into the next quote. */
export async function postOnlyInstruction(client: OpsClient, m: MarketView, config: VenueConfig, order: PostOnlyInput): Promise<Instruction> {
  return getUserPlaceOrderInstructionAsync({
    authority: client.payer, config: config.address, series: m.data.series, market: m.address, book: m.data.book, ledger: m.data.ledger,
    mvault: m.data.mvault, authorityToken: await makerTokenAccount(client.payer.address, config.collateralMint), collateralMint: config.collateralMint,
    eventAuthority: await eventAuthority(), program,
    kind: order.kind, priceTicks: order.priceTicks, lots: order.lots, expireTs: order.expireSec, orderType: POST_ONLY, selfMatch: 0,
    maxFills: 1, maxEvictions: 16, seatHint: order.seatHint, useCredit: true, withdrawProceeds: false, clientId: order.clientId,
  });
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
