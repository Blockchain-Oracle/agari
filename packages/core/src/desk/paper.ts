/**
 * The practice ledger (desk.md §7). A practice desk is a database row with no on-chain account: every check runs the
 * full pipeline on real prices and real Jupiter quotes at the desk's size, and a "would have acted" moves this ledger
 * instead of a token account. Valuation, needs, the gate and the grade run on it exactly as on a live desk.
 *
 * The fee: PreStocks charges 100 bps on every transfer of every name. Whether Jupiter's `outAmount` already nets it is
 * measured at C6.E on the mainnet fork; until then the paper ledger takes `feeBps` off the received leg in both
 * directions, and a measured 0 switches it off. Conservative on purpose: a practice record must never look better than
 * the live desk would have done.
 */
import type { PreIpoSymbol } from "../market/tickers";
import type { DeskSide } from "./needs";
import { BPS } from "./units";

export const PAPER_FEE_BPS = 100;
/** The practice balance the studio offers by default (plan §5.4): $1,000. */
export const DEFAULT_PRACTICE_CASH_E6 = 1_000_000_000n;

export interface PaperLedger {
  cashE6: bigint;
  /** Raw token units (9 dp) per name; absent means none. */
  positions: Partial<Record<PreIpoSymbol, bigint>>;
}

/** The ledger as the database and the API carry it: integer strings. */
export interface PaperLedgerWire {
  cashE6: string;
  positions: Partial<Record<PreIpoSymbol, string>>;
}

export interface PaperFill {
  side: DeskSide;
  symbol: PreIpoSymbol;
  /** USDC E6 for a buy; raw tokens for a sell. */
  amountIn: bigint;
  /** Jupiter's `outAmount` for exactly `amountIn`: raw tokens for a buy; USDC E6 for a sell. */
  quoteOut: bigint;
  /** The transfer fee taken off the received leg, in basis points (`PAPER_FEE_BPS`; 0 once C6.E measures it inside the quote). */
  feeBps: number;
}

export class PaperLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaperLedgerError";
  }
}

export const emptyPaperLedger = (cashE6: bigint = DEFAULT_PRACTICE_CASH_E6): PaperLedger => ({ cashE6, positions: {} });

/** The received leg net of the fee: `out × (10000 − fee) / 10000`, floored. */
export function netOfFee(out: bigint, feeBps: number): bigint {
  if (feeBps < 0 || feeBps > 10_000 || !Number.isInteger(feeBps)) throw new PaperLedgerError(`feeBps ${feeBps} is not in 0..10000`);
  return (out * (BPS - BigInt(feeBps))) / BPS;
}

/** A new ledger with the fill applied; the input is never mutated. Refuses to go negative. */
export function applyPaperFill(ledger: PaperLedger, fill: PaperFill): PaperLedger {
  if (fill.amountIn <= 0n) throw new PaperLedgerError("a fill needs a positive amount in");
  if (fill.quoteOut < 0n) throw new PaperLedgerError("a fill needs a non-negative quote out");
  const held = ledger.positions[fill.symbol] ?? 0n;
  if (fill.side === "buy") {
    if (fill.amountIn > ledger.cashE6) throw new PaperLedgerError(`buy of ${fill.amountIn} USDC base units exceeds the practice cash ${ledger.cashE6}`);
    return { cashE6: ledger.cashE6 - fill.amountIn, positions: { ...ledger.positions, [fill.symbol]: held + netOfFee(fill.quoteOut, fill.feeBps) } };
  }
  if (fill.amountIn > held) throw new PaperLedgerError(`sell of ${fill.amountIn} raw ${fill.symbol} exceeds the practice position ${held}`);
  const left = held - fill.amountIn;
  const positions = { ...ledger.positions };
  if (left === 0n) delete positions[fill.symbol];
  else positions[fill.symbol] = left;
  return { cashE6: ledger.cashE6 + netOfFee(fill.quoteOut, fill.feeBps), positions };
}

/** A practice deposit or withdrawal of cash (the studio's balance control); refuses to go negative. */
export function movePaperCash(ledger: PaperLedger, deltaE6: bigint): PaperLedger {
  const cashE6 = ledger.cashE6 + deltaE6;
  if (cashE6 < 0n) throw new PaperLedgerError("a practice desk cannot withdraw more cash than it holds");
  return { cashE6, positions: { ...ledger.positions } };
}

export function paperLedgerToWire(ledger: PaperLedger): PaperLedgerWire {
  const positions: PaperLedgerWire["positions"] = {};
  for (const [symbol, raw] of Object.entries(ledger.positions) as [PreIpoSymbol, bigint | undefined][]) {
    if (raw !== undefined && raw > 0n) positions[symbol] = raw.toString();
  }
  return { cashE6: ledger.cashE6.toString(), positions };
}

export function paperLedgerFromWire(wire: PaperLedgerWire): PaperLedger {
  const positions: PaperLedger["positions"] = {};
  for (const [symbol, raw] of Object.entries(wire.positions) as [PreIpoSymbol, string | undefined][]) {
    if (raw === undefined) continue;
    if (!/^\d+$/.test(raw)) throw new PaperLedgerError(`position ${symbol} is not an integer string`);
    const value = BigInt(raw);
    if (value > 0n) positions[symbol] = value;
  }
  if (!/^\d+$/.test(wire.cashE6)) throw new PaperLedgerError("cashE6 is not an integer string");
  return { cashE6: BigInt(wire.cashE6), positions };
}
