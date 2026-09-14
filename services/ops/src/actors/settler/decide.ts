/**
 * The settler's next action for one Window (venue-ops.md §7; prints.md §5–6; events-engine.md §8.4–8.5). Pure: plain
 * data and the chain clock in, one action out. The actor reads the Book and Ledger only when this needs them.
 */

export interface SeatSummary {
  index: number;
  program: boolean;
  bonded: boolean;
  drained: boolean;
}

export interface SettleInput {
  nowSec: number;
  /** `Market.state`: 0 open, 1 resolved, 2 voided. */
  state: number;
  expirySec: number;
  openDeadlineSec: number;
  closeDeadlineSec: number;
  prints: { open: boolean; close: boolean; checkOpen: boolean; checkClose: boolean };
  /** The Window's policy version: whether it has a check source, and its `check_admission_sec`. */
  check: { configured: boolean; admissionSec: number };
  bookReleased: boolean;
  ledgerClosed: boolean;
  dependents: number;
  resolvedSec: number;
  retentionSec: number;
  /** Required when terminal with the Book still bound; null = not read. */
  bookOrderCount: number | null;
  /** Required when terminal with the Ledger open: its owned seats; null = not read. */
  seats: readonly SeatSummary[] | null;
}

export type SettleAction =
  | { kind: "settle"; why: string }
  | { kind: "void"; why: string }
  | { kind: "sweep"; why: string }
  | { kind: "redeemFor"; seats: number[]; why: string }
  | { kind: "releaseBook"; why: string }
  | { kind: "closeLedger"; why: string }
  | { kind: "closeMarket"; why: string }
  | { kind: "read"; need: "book" | "seats"; why: string }
  | { kind: "wait"; untilSec: number; why: string };

/** Seats per `public_redeem_for` transaction (each with its idempotent ATA create). */
export const REDEEM_BATCH = 4;
/** How soon to look again at a Window whose prints are due but not yet recorded. */
export const PRINT_POLL_SEC = 10;
/** How soon to look again at something only another party can unblock (products' seats, dependents). */
export const SLOW_POLL_SEC = 60;
/** The close print can't exist before T; look shortly after it. */
export const AFTER_EXPIRY_SEC = 5;

function openWindow(i: SettleInput): SettleAction {
  const { open, close, checkOpen, checkClose } = i.prints;
  if (open && close) {
    const checkBound = i.expirySec + i.check.admissionSec;
    if (i.check.configured && !(checkOpen && checkClose) && i.nowSec <= checkBound) {
      return { kind: "wait", untilSec: checkBound + 1, why: `both prints in; the cross-check stays open until ${checkBound}` };
    }
    const single = i.check.configured && !(checkOpen && checkClose);
    return { kind: "settle", why: i.check.configured ? (single ? "both prints in; check incomplete past its bound (single source)" : "both prints and both checks in") : "both prints in" };
  }
  if (!open && i.nowSec > i.openDeadlineSec) return { kind: "void", why: `no open print by ${i.openDeadlineSec}` };
  if (!close && i.nowSec > i.closeDeadlineSec) return { kind: "void", why: `no close print by ${i.closeDeadlineSec}` };
  const printDue = !close && i.nowSec < i.expirySec ? i.expirySec + AFTER_EXPIRY_SEC : i.nowSec + PRINT_POLL_SEC;
  const deadlines = [!open ? i.openDeadlineSec + 1 : Infinity, !close ? i.closeDeadlineSec + 1 : Infinity];
  return { kind: "wait", untilSec: Math.min(printDue, ...deadlines), why: `waiting for ${[!open && "open", !close && "close"].filter(Boolean).join(" and ")} print` };
}

function terminal(i: SettleInput): SettleAction {
  if (!i.bookReleased) {
    if (i.bookOrderCount === null) return { kind: "read", need: "book", why: "book order count" };
    if (i.bookOrderCount > 0) return { kind: "sweep", why: `${i.bookOrderCount} orders still rest` };
  }
  if (!i.ledgerClosed) {
    if (i.seats === null) return { kind: "read", need: "seats", why: "ledger seats" };
    const redeemable = i.seats.filter((s) => !s.program).map((s) => s.index);
    if (redeemable.length > 0) {
      const batch = redeemable.slice(0, REDEEM_BATCH);
      return { kind: "redeemFor", seats: batch, why: `seats ${batch.join(",")} of ${redeemable.length} to redeem` };
    }
  }
  // Released before the products' seats are waited on: the next Window needs the Book, whatever products still hold.
  if (!i.bookReleased) return { kind: "releaseBook", why: "book empty" };
  if (!i.ledgerClosed) {
    const held = i.seats!.filter((s) => s.program && (!s.drained || s.bonded));
    if (held.length > 0) return { kind: "wait", untilSec: i.nowSec + SLOW_POLL_SEC, why: `PROGRAM seats ${held.map((s) => s.index).join(",")} not drained` };
    return { kind: "closeLedger", why: "every seat drained" };
  }
  if (i.dependents > 0) return { kind: "wait", untilSec: i.nowSec + SLOW_POLL_SEC, why: `${i.dependents} dependents remain` };
  const retained = i.resolvedSec + i.retentionSec;
  if (i.nowSec < retained) return { kind: "wait", untilSec: retained, why: `result retained until ${retained}` };
  return { kind: "closeMarket", why: "retention elapsed" };
}

export function decideSettle(i: SettleInput): SettleAction {
  return i.state === 0 ? openWindow(i) : terminal(i);
}
