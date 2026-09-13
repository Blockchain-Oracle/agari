"use client";

import { countdown } from "@masayume/core/lifecycle";
import type { OpenPosition } from "@masayume/core/types";
import { marketDeepLink } from "@masayume/core/urls";
import Link from "next/link";
import { Countdown, Money } from "@/components/data";
import { formatCadence, PORTFOLIO } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { SIDE_WORD } from "../side-styles";

interface BetRowProps {
  position: OpenPosition;
  symbol: string | undefined;
  /** Chain-corrected clock; 0 before the first client tick. */
  nowMs: number;
}

/** UP, DOWN, or both — a position can hold either token, and merging them into one word would hide a hedge. */
function sideLabel(position: OpenPosition): string {
  const up = position.balanceUpRaw > 0n;
  const down = position.balanceDownRaw > 0n;
  if (up && down) return PORTFOLIO.bothSides;
  return up ? SIDE_WORD.up : SIDE_WORD.down;
}

/**
 * One open bet.
 *
 * Ported from `reference/yosuku/components/Portfolio624Section.tsx` (L431). Its
 * status column stays silent while a bet is live — the pulsing dot and the
 * countdown beside it already say so twice. Leverage is not a column here: it is
 * Stage 5, and a `1×` on every row would be a number pretending to be a choice.
 */
export function BetRow({ position, symbol, nowMs }: BetRowProps) {
  const state = nowMs > 0 ? countdown(nowMs, position.expirySec, position.intervalSec) : null;
  const settling = state?.settling ?? false;

  return (
    <li className="bets-row">
      <span className={cn("type-label-micro shrink-0", settling ? "text-ink" : "text-ink-secondary")}>
        {settling ? (
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
        {position.asset} {sideLabel(position)}
      </Link>
      <span className="type-label-micro text-ink-muted">{formatCadence(position.intervalSec)}</span>

      {!settling && (
        <span className="type-caption text-ink-secondary">
          <Countdown expirySec={position.expirySec} intervalSec={position.intervalSec} nowMs={nowMs} /> {PORTFOLIO.left}
        </span>
      )}

      <span className="bets-break" aria-hidden />
      <span className="flex-1" />

      <span className="type-caption text-ink-secondary">
        {PORTFOLIO.stake} <Money value={position.costBasisBase} decimals={position.decimals} symbol={symbol} />
      </span>
      <span className="type-caption text-ink-secondary">
        {PORTFOLIO.value} <Money value={position.markValueBase} decimals={position.decimals} />
      </span>
      <Money value={position.unrealizedPnlBase} decimals={position.decimals} tone="pnl" className="type-data shrink-0" />
    </li>
  );
}
