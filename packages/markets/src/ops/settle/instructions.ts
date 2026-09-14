/**
 * Settler instructions (events-instructions.md §5, venue-ops.md §7). Builders only: the actor reconciles, then sends
 * through `sendOps` with the settler client, whose key is the payer (MarketResult rent, owners' ATAs).
 */
import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  getPublicCloseLedgerInstructionAsync,
  getPublicCloseMarketInstructionAsync,
  getPublicRedeemForInstructionAsync,
  getPublicReleaseBookInstruction,
  getPublicSettleWindowInstructionAsync,
  getPublicSweepExpiredInstruction,
  getPublicVoidExpiredInstructionAsync,
} from "@agari/clients/agari-events";
import type { Address, Instruction } from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { eventAuthority } from "../../deploy/cycle/accounts";
import type { OpsClient } from "../client";
import type { MarketView } from "../venue";
import type { VenueConfig } from "./reads";

const program = AGARI_EVENTS_PROGRAM_ADDRESS;

/** Settle or void: the payer funds `MarketResult` and gets it back at `public_close_market`. */
export async function settleInstruction(client: OpsClient, m: MarketView): Promise<Instruction> {
  return getPublicSettleWindowInstructionAsync({ payer: client.payer, series: m.data.series, market: m.address, eventAuthority: await eventAuthority(), program });
}

export async function voidInstruction(client: OpsClient, m: MarketView): Promise<Instruction> {
  return getPublicVoidExpiredInstructionAsync({ payer: client.payer, series: m.data.series, market: m.address, eventAuthority: await eventAuthority(), program });
}

export async function sweepInstruction(m: MarketView, max = 32): Promise<Instruction> {
  return getPublicSweepExpiredInstruction({
    series: m.data.series, market: m.address, book: m.data.book, ledger: m.data.ledger, eventAuthority: await eventAuthority(), program, max,
  });
}

export async function releaseBookInstruction(m: MarketView): Promise<Instruction> {
  return getPublicReleaseBookInstruction({ series: m.data.series, market: m.address, book: m.data.book, eventAuthority: await eventAuthority(), program });
}

/** One seat's full redeem to its owner's ATA, preceded by an idempotent ATA create paid by the settler (AD-5). */
export async function redeemForInstructions(client: OpsClient, m: MarketView, config: VenueConfig, seat: { index: number; owner: Address }): Promise<Instruction[]> {
  const mint = config.collateralMint;
  const [ownerAta] = await findAssociatedTokenPda({ owner: seat.owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const createAta = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: client.payer, ata: ownerAta, owner: seat.owner, mint });
  const redeem = await getPublicRedeemForInstructionAsync({
    config: config.address, series: m.data.series, market: m.address, ledger: m.data.ledger, mvault: m.data.mvault,
    owner: seat.owner, ownerAta, collateralMint: mint, eventAuthority: await eventAuthority(), program, seatIdx: seat.index,
  });
  return [createAta, redeem];
}

/** Residue to the treasury, mvault and Ledger rent to `ledger.rent_payer` (the roller). */
export async function closeLedgerInstruction(m: MarketView, config: VenueConfig, ledgerRentPayer: Address): Promise<Instruction> {
  return getPublicCloseLedgerInstructionAsync({
    config: config.address, market: m.address, ledger: m.data.ledger, mvault: m.data.mvault, treasury: config.treasury,
    rentPayer: ledgerRentPayer, collateralMint: config.collateralMint, eventAuthority: await eventAuthority(), program,
  });
}

/** Market rent to `market.rent_payer` (roller), MarketResult rent to `result.rent_payer` (the settle payer). */
export async function closeMarketInstruction(m: MarketView, config: VenueConfig, result: { result: Address; rentPayer: Address }): Promise<Instruction> {
  return getPublicCloseMarketInstructionAsync({
    market: m.address, result: result.result, marketRentPayer: m.data.rentPayer, resultRentPayer: result.rentPayer,
    config: config.address, eventAuthority: await eventAuthority(), program,
  });
}
