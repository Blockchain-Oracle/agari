import { describe, expect, it } from "vitest";
import { decideSettle, REDEEM_BATCH, type SettleInput } from "./decide";

const T0 = 1_789_400_000;
const T1 = T0 + 300;

function input(over: Partial<SettleInput> = {}): SettleInput {
  return {
    nowSec: T1 + 20,
    state: 0,
    expirySec: T1,
    openDeadlineSec: T0 + 900,
    closeDeadlineSec: T1 + 900,
    prints: { open: true, close: true, checkOpen: false, checkClose: false },
    check: { configured: false, admissionSec: 0 },
    bookReleased: false,
    ledgerClosed: false,
    dependents: 0,
    resolvedSec: 0,
    retentionSec: 21_600,
    bookOrderCount: null,
    seats: null,
    ...over,
  };
}

const seat = (index: number, over: Partial<{ program: boolean; bonded: boolean; drained: boolean }> = {}) => ({ index, program: false, bonded: true, drained: false, ...over });

describe("decideSettle: open Windows", () => {
  it("settles once both primary prints are in and no check is configured", () => {
    expect(decideSettle(input()).kind).toBe("settle");
  });

  it("waits for the cross-check until its bound, inclusive, then settles single-source", () => {
    const checked = { check: { configured: true, admissionSec: 120 }, prints: { open: true, close: true, checkOpen: true, checkClose: false } };
    const atBound = decideSettle(input({ ...checked, nowSec: T1 + 120 }));
    expect(atBound).toMatchObject({ kind: "wait", untilSec: T1 + 121 });
    const past = decideSettle(input({ ...checked, nowSec: T1 + 121 }));
    expect(past.kind).toBe("settle");
    expect(past.why).toMatch(/single source/);
  });

  it("settles before the check bound when both checks are in", () => {
    const all = { open: true, close: true, checkOpen: true, checkClose: true };
    expect(decideSettle(input({ check: { configured: true, admissionSec: 120 }, prints: all, nowSec: T1 + 30 })).kind).toBe("settle");
  });

  it("voids a missing open print only after its deadline (exclusive)", () => {
    const noOpen = { prints: { open: false, close: true, checkOpen: false, checkClose: false } };
    expect(decideSettle(input({ ...noOpen, nowSec: T0 + 900 }))).toMatchObject({ kind: "wait", untilSec: T0 + 901 });
    expect(decideSettle(input({ ...noOpen, nowSec: T0 + 901 })).kind).toBe("void");
  });

  it("voids a missing close print only after the close deadline", () => {
    const noClose = { prints: { open: true, close: false, checkOpen: false, checkClose: false } };
    expect(decideSettle(input({ ...noClose, nowSec: T1 + 900 })).kind).toBe("wait");
    expect(decideSettle(input({ ...noClose, nowSec: T1 + 901 })).kind).toBe("void");
  });

  it("looks again just after expiry while trading, and polls once the close print is due", () => {
    const trading = decideSettle(input({ prints: { open: true, close: false, checkOpen: false, checkClose: false }, nowSec: T0 + 100 }));
    expect(trading).toMatchObject({ kind: "wait", untilSec: T1 + 5 });
    const due = decideSettle(input({ prints: { open: true, close: false, checkOpen: false, checkClose: false }, nowSec: T1 + 30 }));
    expect(due).toMatchObject({ kind: "wait", untilSec: T1 + 40 });
  });

  it("wakes at an early open deadline on a long Window (void before lock)", () => {
    const long = input({ expirySec: T0 + 3_600, closeDeadlineSec: T0 + 4_500, prints: { open: false, close: false, checkOpen: false, checkClose: false }, nowSec: T0 + 60 });
    expect(decideSettle(long)).toMatchObject({ kind: "wait", untilSec: T0 + 901 });
    expect(decideSettle({ ...long, nowSec: T0 + 901 }).kind).toBe("void");
  });
});

describe("decideSettle: terminal Windows", () => {
  const terminal = (over: Partial<SettleInput>) => input({ state: 1, resolvedSec: T1 + 30, nowSec: T1 + 60, ...over });

  it("asks for the reads it needs", () => {
    expect(decideSettle(terminal({}))).toMatchObject({ kind: "read", need: "book" });
    expect(decideSettle(terminal({ bookOrderCount: 0 }))).toMatchObject({ kind: "read", need: "seats" });
  });

  it("sweeps resting orders before anything else", () => {
    expect(decideSettle(terminal({ bookOrderCount: 3, seats: [seat(8)] })).kind).toBe("sweep");
  });

  it("redeems public seats in batches, never PROGRAM seats", () => {
    const seats = [seat(0, { program: true }), ...[8, 9, 10, 11, 12].map((i) => seat(i))];
    const action = decideSettle(terminal({ bookOrderCount: 0, seats }));
    expect(action).toMatchObject({ kind: "redeemFor", seats: [8, 9, 10, 11].slice(0, REDEEM_BATCH) });
  });

  it("releases the Book, then closes the Ledger once every seat is drained", () => {
    expect(decideSettle(terminal({ bookOrderCount: 0, seats: [] })).kind).toBe("releaseBook");
    expect(decideSettle(terminal({ bookReleased: true, seats: [seat(0, { program: true, bonded: false, drained: true })] })).kind).toBe("closeLedger");
  });

  it("waits on an undrained PROGRAM seat, but still releases the Book first", () => {
    const held = [seat(1, { program: true, bonded: false, drained: false })];
    expect(decideSettle(terminal({ bookOrderCount: 0, seats: held })).kind).toBe("releaseBook");
    expect(decideSettle(terminal({ bookReleased: true, seats: held }))).toMatchObject({ kind: "wait", untilSec: T1 + 120 });
  });

  it("closes the Market only after retention, with no dependents", () => {
    const closed = { bookReleased: true, ledgerClosed: true };
    expect(decideSettle(terminal({ ...closed, dependents: 1 })).kind).toBe("wait");
    expect(decideSettle(terminal({ ...closed, nowSec: T1 + 30 + 21_599 }))).toMatchObject({ kind: "wait", untilSec: T1 + 30 + 21_600 });
    expect(decideSettle(terminal({ ...closed, nowSec: T1 + 30 + 21_600 })).kind).toBe("closeMarket");
  });

  it("drains a voided Window the same way", () => {
    expect(decideSettle(input({ state: 2, bookOrderCount: 1, seats: [] })).kind).toBe("sweep");
  });
});
