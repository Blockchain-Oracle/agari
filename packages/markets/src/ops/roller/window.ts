/**
 * `roller_open_window` for any lane, and the Book recycling and Ledger growth the roller owns (venue-ops.md §5).
 * The client's payer is the roller key: it signs as roller and pays Market, Ledger and mvault rent.
 */
import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  getPublicGrowLedgerInstructionAsync,
  getPublicReleaseBookInstruction,
  getPublicSweepExpiredInstruction,
  getRollerOpenWindowInstructionAsync,
} from "@agari/clients/agari-events";
import type { Address } from "@solana/kit";
import { eventAuthority, windowAddresses } from "../../deploy/cycle/accounts";
import type { OpsClient } from "../client";
import { sendOps } from "../send";

/** `BoundaryKind` (events-accounts.md §2). */
export const BOUNDARY_KIND = { Intraday: 0, SessionOpen: 1, SessionClose: 2 } as const;

export type OpenWindowInput = {
  series: Address;
  /** Must equal `series.next_index`. */
  index: bigint;
  book: Address;
  collateralMint: Address;
  tradingStartSec: number;
  lockAtSec: number;
  expirySec: number;
  policyVersion: number;
  openKind: number;
  closeKind: number;
};

export type OpenedWindowRef = { market: Address; ledger: Address; mvault: Address; signature: string };

export async function openWindow(client: OpsClient, input: OpenWindowInput): Promise<OpenedWindowRef> {
  const w = await windowAddresses(input.series, input.index);
  // Codama names the boundaries without unit suffixes; the locals keep the `time-suffix` invariant honest.
  const [tradingStart, expiry] = [input.tradingStartSec, input.expirySec];
  const ix = await getRollerOpenWindowInstructionAsync({
    roller: client.payer,
    payer: client.payer,
    series: input.series,
    market: w.market,
    book: input.book,
    collateralMint: input.collateralMint,
    eventAuthority: await eventAuthority(),
    program: AGARI_EVENTS_PROGRAM_ADDRESS,
    index: input.index,
    tradingStart,
    lockAt: input.lockAtSec,
    expiry,
    policyVersion: input.policyVersion,
    openKind: input.openKind,
    closeKind: input.closeKind,
  });
  const { signature } = await sendOps(client, [ix], `roller_open_window #${input.index}`);
  return { market: w.market, ledger: w.ledger, mvault: w.mvault, signature };
}

export type BoundWindowRef = { series: Address; market: Address; book: Address; ledger: Address };

/** `public_sweep_expired(max)`: drains expired or post-lock orders from the Market's Book. */
export async function sweepBook(client: OpsClient, w: BoundWindowRef, max = 32): Promise<string> {
  const ix = getPublicSweepExpiredInstruction({
    series: w.series, market: w.market, book: w.book, ledger: w.ledger, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS, max,
  });
  return (await sendOps(client, [ix], `public_sweep_expired ${w.market}`)).signature;
}

/** `public_release_book`: the Book goes back to the Series' free list (status Locked or terminal, no orders). */
export async function releaseBook(client: OpsClient, w: Omit<BoundWindowRef, "ledger">): Promise<string> {
  const ix = getPublicReleaseBookInstruction({ series: w.series, market: w.market, book: w.book, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS });
  return (await sendOps(client, [ix], `public_release_book ${w.book}`)).signature;
}

/** PD-8 growth: `public_grow_ledger(extra_seats ≤ 116)`, paid by the roller. */
export async function growLedger(client: OpsClient, input: { market: Address; ledger: Address; extraSeats: number }): Promise<string> {
  const ix = await getPublicGrowLedgerInstructionAsync({
    payer: client.payer, market: input.market, ledger: input.ledger, eventAuthority: await eventAuthority(), program: AGARI_EVENTS_PROGRAM_ADDRESS, extraSeats: input.extraSeats,
  });
  return (await sendOps(client, [ix], `public_grow_ledger ${input.ledger}`)).signature;
}
