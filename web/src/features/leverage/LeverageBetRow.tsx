"use client";

import { equityOf, type LeverageMark, type LeveragePosition } from "@masayume/core/leverage";
import { countdown } from "@masayume/core/lifecycle";
import { formatBaseUnits } from "@masayume/core/units";
import { marketDeepLink } from "@masayume/core/urls";
import Link from "next/link";
import { Countdown, Money } from "@/components/data";
import { formatCadence, PORTFOLIO } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { SIDE_WORD } from "../markets/side-styles";
import { LEVERAGE } from "./copy";
import type { LeverageBusyKey } from "./useLeverageWrites";

/** The owner's own slippage guard on a cash-out: the book may move between the mark and the send. */
const CASH_OUT_FLOOR_BPS = 9_700n;

export interface LeverageBetRowProps {
  position: LeveragePosition;
  /** The Window's asset and cadence; null until the market read lands. */
  market: { asset: string; intervalSec: number } | null;
  /** The live mark against the knock-out line; null until read, or for a position that is not live. */
  mark: LeverageMark | null;
  symbol: string | undefined;
  decimals: number;
  nowMs: number;
  busy: LeverageBusyKey | null;
  canSign: boolean;
  isOwner: boolean;
  onCashOut: (position: LeveragePosition, minProceedsBase: bigint) => void;
  onSettle: (position: LeveragePosition) => void;
}

/** One decimal, as the reference's `fmtLeverage` (a position opened off-chip at an odd bps still reads as a multiple). */
function multipleOf(position: LeveragePosition): number {
  return Math.round(position.leverageBps / 1_000) / 10;
}

function settledLabel(position: LeveragePosition): string {
  const { bets } = LEVERAGE;
  if (position.status === "knocked-out") return bets.knockedOut;
  if (position.status === "closed") return bets.closed;
  if (position.returnedBase === 0n) return bets.lost;
  return position.returnedBase > position.stakeBase ? bets.won : bets.settled;
}

/**
 * One boost the reserve holds for the wallet — `BetRow`'s grammar (reference `Portfolio624Section` L431)
 * with the reference's leverage column made real: the multiple only where it is one, and beside it what
 * the reference's `LeveragePortfolioPanel` showed for a live position — your equity at the book's mark
 * and the line it knocks out at, as words. The 2026-09-02 meter and rolling figure were reverted on the
 * user's 2026-09-04 call: the reference's row is flat. Settled, knocked-out and cashed-out boosts keep
 * their row and say what came back.
 */
export function LeverageBetRow(p: LeverageBetRowProps) {
  const { position, market, mark, symbol, decimals, nowMs, busy, canSign, isOwner, onCashOut, onSettle } = p;
  const { bets } = LEVERAGE;
  const live = position.status === "live";
  const state = live && market && nowMs > 0 ? countdown(nowMs, position.expirySec, market.intervalSec) : null;
  const settling = state?.settling ?? false;
  const priced = mark !== null && mark.filledRaw >= position.quantityRaw;
  const equity = mark ? equityOf(mark.markBase, position.frontedBase) : null;
  const minProceeds = mark ? (mark.markBase * CASH_OUT_FLOOR_BPS) / 10_000n : 0n;
  const cashingOut = busy === `close:${position.positionId}`;
  const settlingNow = busy === `settle:${position.positionId}`;

  return (
    <li className="bets-row">
      <span className={cn("type-label-micro shrink-0", live && !settling ? "text-ink-secondary" : "text-ink")}>
        {!live ? (
          settledLabel(position)
        ) : settling ? (
          PORTFOLIO.settling
        ) : (
          <>
            <span aria-hidden className="mr-1.5 text-accent">
              ●
            </span>
            {PORTFOLIO.live}
          </>
        )}
      </span>
      <Link href={marketDeepLink({ marketId: position.marketId })} data-cursor="hover" className="type-body-strong text-ink">
        {market?.asset ?? "…"} {SIDE_WORD[position.side]}
      </Link>
      {market && <span className="type-label-micro text-ink-muted">{formatCadence(market.intervalSec)}</span>}
      <span className="type-label-micro text-accent">{bets.boosted(multipleOf(position))}</span>
      {live && !settling && market && (
        <span className="type-caption text-ink-secondary">
          <Countdown expirySec={position.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} /> {PORTFOLIO.left}
        </span>
      )}
      <span className="bets-break" aria-hidden />
      <span className="flex-1" />
      <span className="type-caption text-ink-secondary">
        {bets.staked} <Money value={position.stakeBase} decimals={decimals} symbol={symbol} />
      </span>
      {live ? (
        <>
          {priced && equity !== null ? (
            <span className="type-caption text-ink-secondary">
              {bets.yours} <Money value={equity} decimals={decimals} symbol={symbol} />
            </span>
          ) : (
            <span className="type-caption text-ink-muted">{bets.unpriced}</span>
          )}
          {mark && position.frontedBase > 0n && (
            <span className={cn("type-caption", mark.knockable ? "text-warning" : "text-ink-muted")}>
              {mark.knockable ? bets.knockable : bets.line(formatBaseUnits(mark.lineBase, decimals))}
            </span>
          )}
          {settling
            ? canSign && (
                <button type="button" className="type-caption text-accent underline" disabled={settlingNow} onClick={() => onSettle(position)} data-cursor="hover">
                  {settlingNow ? bets.settling : bets.settle}
                </button>
              )
            : isOwner &&
              canSign &&
              priced && (
                <button type="button" className="type-caption text-accent underline" disabled={cashingOut} onClick={() => onCashOut(position, minProceeds)} data-cursor="hover">
                  {cashingOut ? bets.cashingOut : bets.cashOut}
                </button>
              )}
        </>
      ) : (
        <span className="type-caption text-ink-secondary">
          {position.returnedBase > 0n ? bets.paid(formatBaseUnits(position.returnedBase, decimals), symbol ?? "") : bets.nothingBack}
        </span>
      )}
    </li>
  );
}
