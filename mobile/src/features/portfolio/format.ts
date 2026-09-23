import type { Side } from "@agari/core/types";
import { countdown } from "@agari/core/lifecycle";
import { formatBaseUnits, formatClock } from "@agari/core/units";
import { PORTFOLIO } from "@/lib/copy";
import { SIDE_WORD } from "@/features/markets/side-styles";

/** The plate's two-place figure (web `LedgerPlate` fmt2). */
export function fmt2(base: bigint, decimals: number): string {
  return formatBaseUnits(base, decimals, { maxDp: 2, minDp: 2 });
}

/** web's `<Money value decimals symbol>`: the full-precision figure, the collateral's own ticker after it. */
export function money(base: bigint, decimals: number, symbol?: string | null): string {
  return `${formatBaseUnits(base, decimals)} ${symbol ?? ""}`.trim();
}

/** web's `<Money tone="pnl">`: signed, so direction never depends on colour. */
export function signedMoney(base: bigint, decimals: number, symbol?: string | null): string {
  return `${formatBaseUnits(base, decimals, { signed: true })} ${symbol ?? ""}`.trim();
}

/** The one side a row holds, or null for a hedge: a plain cash-out sells one side (web `BetRow.heldSide`, L-35). */
export function heldSide(upRaw: bigint, downRaw: bigint): Side | null {
  if (upRaw > 0n && downRaw === 0n) return "up";
  if (downRaw > 0n && upRaw === 0n) return "down";
  return null;
}

/** UP, DOWN, or both — merging them into one word would hide a hedge (web `BetRow.sideLabel`). */
export function sidesWord(upRaw: bigint, downRaw: bigint): string {
  if (upRaw > 0n && downRaw > 0n) return PORTFOLIO.bothSides;
  return upRaw > 0n ? SIDE_WORD.up : SIDE_WORD.down;
}

/** web's `<Countdown>` text: the chain-corrected time left to expiry, or null before the first tick. */
export function clockLeft(expirySec: number, intervalSec: number, nowMs: number): string | null {
  if (nowMs <= 0) return null;
  return formatClock(countdown(nowMs, expirySec, intervalSec).remainingSec);
}

/** web's pnl tone: profit above zero, loss below, plain ink at exactly zero. */
export function pnlTone(base: bigint): "profit" | "loss" | undefined {
  return base > 0n ? "profit" : base < 0n ? "loss" : undefined;
}
