import { describe, expect, it } from "vitest";
import { applyPaperFill, DEFAULT_PRACTICE_CASH_E6, emptyPaperLedger, movePaperCash, netOfFee, PAPER_FEE_BPS, paperLedgerFromWire, PaperLedgerError, paperLedgerToWire } from "./paper";

describe("the practice ledger", () => {
  it("starts with $1,000 and no positions", () => {
    expect(emptyPaperLedger()).toEqual({ cashE6: DEFAULT_PRACTICE_CASH_E6, positions: {} });
  });

  it("a buy takes the USDC off cash and adds the quote net of the 1% fee, without touching the input", () => {
    const before = emptyPaperLedger();
    const after = applyPaperFill(before, { side: "buy", symbol: "ANTHROPIC", amountIn: 50_000_000n, quoteOut: 47_781_610n, feeBps: PAPER_FEE_BPS });
    expect(after).toEqual({ cashE6: 950_000_000n, positions: { ANTHROPIC: 47_303_793n } });
    expect(before.positions).toEqual({});
    expect(netOfFee(47_781_610n, 100)).toBe(47_303_793n);
    expect(netOfFee(47_781_610n, 0)).toBe(47_781_610n);
  });

  it("a sell takes the gross tokens off the position and adds the quote net of the fee; an emptied position disappears", () => {
    const held = { cashE6: 950_000_000n, positions: { ANTHROPIC: 47_303_793n, OPENAI: 5n } };
    const part = applyPaperFill(held, { side: "sell", symbol: "ANTHROPIC", amountIn: 7_303_793n, quoteOut: 7_600_000n, feeBps: PAPER_FEE_BPS });
    expect(part).toEqual({ cashE6: 957_524_000n, positions: { ANTHROPIC: 40_000_000n, OPENAI: 5n } });
    const all = applyPaperFill(part, { side: "sell", symbol: "ANTHROPIC", amountIn: 40_000_000n, quoteOut: 41_000_000n, feeBps: 0 });
    expect(all.positions).toEqual({ OPENAI: 5n });
    expect(all.cashE6).toBe(998_524_000n);
  });

  it("refuses to go negative or to take a bad fee", () => {
    const ledger = emptyPaperLedger(10_000_000n);
    expect(() => applyPaperFill(ledger, { side: "buy", symbol: "OPENAI", amountIn: 10_000_001n, quoteOut: 1n, feeBps: 100 })).toThrow(PaperLedgerError);
    expect(() => applyPaperFill(ledger, { side: "sell", symbol: "OPENAI", amountIn: 1n, quoteOut: 1n, feeBps: 100 })).toThrow("exceeds the practice position");
    expect(() => applyPaperFill(ledger, { side: "buy", symbol: "OPENAI", amountIn: 0n, quoteOut: 1n, feeBps: 100 })).toThrow("positive amount");
    expect(() => netOfFee(1n, 10_001)).toThrow("0..10000");
    expect(() => movePaperCash(ledger, -10_000_001n)).toThrow("cannot withdraw");
    expect(movePaperCash(ledger, 5_000_000n).cashE6).toBe(15_000_000n);
  });

  it("round-trips through the wire and drops empty positions", () => {
    const ledger = { cashE6: 123n, positions: { OPENAI: 5n, ANTHROPIC: 0n } };
    const wire = paperLedgerToWire(ledger);
    expect(wire).toEqual({ cashE6: "123", positions: { OPENAI: "5" } });
    expect(paperLedgerFromWire(wire)).toEqual({ cashE6: 123n, positions: { OPENAI: 5n } });
    expect(() => paperLedgerFromWire({ cashE6: "1.5", positions: {} })).toThrow(PaperLedgerError);
    expect(() => paperLedgerFromWire({ cashE6: "1", positions: { OPENAI: "-1" } })).toThrow(PaperLedgerError);
  });
});
