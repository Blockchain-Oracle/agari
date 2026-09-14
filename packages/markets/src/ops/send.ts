/**
 * Sending for venue actors (venue-ops.md §3). Actors reconcile before they send, so a failure carrying an
 * "already done" engine code means another writer (or an earlier pass) won the race: treat it as done, never resend.
 */
import {
  AGARI_EVENTS_ERROR__BAD_WINDOW_INDEX,
  AGARI_EVENTS_ERROR__BOOK_MARKET_MISMATCH,
  AGARI_EVENTS_ERROR__BOOK_NOT_RELEASED,
  AGARI_EVENTS_ERROR__CROSS_CHECK_PENDING,
  AGARI_EVENTS_ERROR__DEPENDENTS_REMAIN,
  AGARI_EVENTS_ERROR__LEDGER_NOT_CLOSED,
  AGARI_EVENTS_ERROR__LEDGER_NOT_EMPTY,
  AGARI_EVENTS_ERROR__MARKET_ALREADY_TERMINAL,
  AGARI_EVENTS_ERROR__MARKET_NOT_LOCKED,
  AGARI_EVENTS_ERROR__MARKET_NOT_TERMINAL,
  AGARI_EVENTS_ERROR__NO_FREE_BOOK,
  AGARI_EVENTS_ERROR__OPEN_ORDERS_REMAIN,
  AGARI_EVENTS_ERROR__POST_ONLY_WOULD_CROSS,
  AGARI_EVENTS_ERROR__PRINT_ALREADY_RECORDED,
  AGARI_EVENTS_ERROR__PRINT_TOO_EARLY,
  AGARI_EVENTS_ERROR__PRINT_TOO_LATE,
  AGARI_EVENTS_ERROR__PRINTS_MISSING,
  AGARI_EVENTS_ERROR__RETENTION_NOT_ELAPSED,
  AGARI_EVENTS_ERROR__SEAT_MISMATCH,
  AGARI_EVENTS_ERROR__SETTLEMENT_WINDOW_OPEN,
  AGARI_EVENTS_ERROR__SOURCE_NOT_COVERED,
  AGARI_EVENTS_ERROR__WINDOW_OVERLAP,
} from "@agari/clients/agari-events";
import type { Instruction } from "@solana/kit";
import { describeSendError } from "../deploy/send";
import type { OpsClient } from "./client";

/** The engine codes actors branch on. Numbers, so `services/ops` never imports the client package. */
export const ENGINE_ERROR = {
  badWindowIndex: AGARI_EVENTS_ERROR__BAD_WINDOW_INDEX,
  windowOverlap: AGARI_EVENTS_ERROR__WINDOW_OVERLAP,
  noFreeBook: AGARI_EVENTS_ERROR__NO_FREE_BOOK,
  bookMarketMismatch: AGARI_EVENTS_ERROR__BOOK_MARKET_MISMATCH,
  sourceNotCovered: AGARI_EVENTS_ERROR__SOURCE_NOT_COVERED,
  seatMismatch: AGARI_EVENTS_ERROR__SEAT_MISMATCH,
  postOnlyWouldCross: AGARI_EVENTS_ERROR__POST_ONLY_WOULD_CROSS,
  marketNotLocked: AGARI_EVENTS_ERROR__MARKET_NOT_LOCKED,
  marketNotTerminal: AGARI_EVENTS_ERROR__MARKET_NOT_TERMINAL,
  marketAlreadyTerminal: AGARI_EVENTS_ERROR__MARKET_ALREADY_TERMINAL,
  printAlreadyRecorded: AGARI_EVENTS_ERROR__PRINT_ALREADY_RECORDED,
  printTooEarly: AGARI_EVENTS_ERROR__PRINT_TOO_EARLY,
  printTooLate: AGARI_EVENTS_ERROR__PRINT_TOO_LATE,
  crossCheckPending: AGARI_EVENTS_ERROR__CROSS_CHECK_PENDING,
  retentionNotElapsed: AGARI_EVENTS_ERROR__RETENTION_NOT_ELAPSED,
  printsMissing: AGARI_EVENTS_ERROR__PRINTS_MISSING,
  settlementWindowOpen: AGARI_EVENTS_ERROR__SETTLEMENT_WINDOW_OPEN,
  openOrdersRemain: AGARI_EVENTS_ERROR__OPEN_ORDERS_REMAIN,
  ledgerNotEmpty: AGARI_EVENTS_ERROR__LEDGER_NOT_EMPTY,
  dependentsRemain: AGARI_EVENTS_ERROR__DEPENDENTS_REMAIN,
  bookNotReleased: AGARI_EVENTS_ERROR__BOOK_NOT_RELEASED,
  ledgerNotClosed: AGARI_EVENTS_ERROR__LEDGER_NOT_CLOSED,
} as const;

const ENGINE_CODES = { min: 6000, max: 6399 };

/** The first agari-events custom error code on a Kit error's cause chain, or null. */
export function engineErrorCode(error: unknown): number | null {
  for (let e: unknown = error, depth = 0; e && depth < 8; e = (e as { cause?: unknown }).cause, depth++) {
    const code = (e as { context?: { code?: unknown } }).context?.code;
    if (typeof code === "number" && code >= ENGINE_CODES.min && code <= ENGINE_CODES.max) return code;
  }
  return null;
}

/** A failed send: `code` is the engine error (null for RPC, blockhash or other failures); `message` is log-safe. */
export class OpsSendError extends Error {
  readonly code: number | null;
  constructor(label: string, cause: unknown) {
    super(`${label} failed: ${describeSendError(cause)}`, { cause });
    this.name = "OpsSendError";
    this.code = engineErrorCode(cause);
  }
}

/**
 * A send that hasn't confirmed by then is abandoned (a stalled confirmation subscription once hung a roller pass for
 * 50 minutes). The transaction may still land: the actor's next pass re-reads chain state before acting.
 */
export const SEND_TIMEOUT_MS = 120_000;

/** Sends one transaction and waits for confirmation, at most `SEND_TIMEOUT_MS`. Throws `OpsSendError`. */
export async function sendOps(client: OpsClient, instructions: Instruction[], label: string): Promise<{ signature: string }> {
  try {
    const result = await client.sendTransaction(instructions, { abortSignal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
    return { signature: String(result.context.signature) };
  } catch (error) {
    throw new OpsSendError(label, error);
  }
}
