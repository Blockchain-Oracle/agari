"use client";

import { countdown } from "@agari/core/lifecycle";
import type { OpenPosition, Side } from "@agari/core/types";
import { marketDeepLink } from "@agari/core/urls";
import Link from "next/link";
import { Countdown, Money } from "@/components/data";
import { formatCadence, PORTFOLIO } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { AssetDisc } from "../hero/asset-mark";
import { SIDE_WORD } from "../side-styles";
import { CASH_OUT, useCashOut, type CashOutTarget } from "./useCashOut";

interface BetRowProps {
  position: OpenPosition;
  symbol: string | undefined;
  /** Chain-corrected clock; 0 before the first client tick. */
  nowMs: number;
  /** Fixtures only: a canned cash-out state instead of the live link. */
  cashOutPreview?: CashOutState;
}

/** UP, DOWN, or both — a position can hold either token, and merging them into one word would hide a hedge. */
function sideLabel(position: OpenPosition): string {
  const up = position.balanceUpRaw > 0n;
  const down = position.balanceDownRaw > 0n;
  if (up && down) return PORTFOLIO.bothSides;
  return up ? SIDE_WORD.up : SIDE_WORD.down;
}

/** The one side a row holds, or null for a hedge: a plain cash-out sells one side (L-35). */
export function heldSide(upRaw: bigint, downRaw: bigint): Side | null {
  if (upRaw > 0n && downRaw === 0n) return "up";
  if (downRaw > 0n && upRaw === 0n) return "down";
  return null;
}

export interface CashOutState {
  busy: boolean;
  note: string | null;
}

/** `LeverageBetRow`'s cash-out link (`type-caption text-accent underline`), with its refusal as a sentence beside it. */
export function CashOutLinkView({ busy, note, onCashOut }: CashOutState & { onCashOut: () => void }) {
  return (
    <>
      <button type="button" className="type-caption text-accent underline" disabled={busy} onClick={onCashOut} data-cursor="hover">
        {busy ? CASH_OUT.cashingOut : CASH_OUT.cashOut}
      </button>
      {note && (
        <span className="type-caption basis-full text-left text-warning sm:text-right" role="status">
          {note}
        </span>
      )}
    </>
  );
}

/** The live link: shown only where a wallet can sign the sell. */
export function CashOutLink(target: CashOutTarget) {
  const { canSign, busy, note, cashOut } = useCashOut(target);
  return canSign ? <CashOutLinkView busy={busy} note={note} onCashOut={() => void cashOut()} /> : null;
}

/**
 * One open bet.
 *
 * Ported from `reference/yosuku/components/Portfolio624Section.tsx` (L431). Its
 * status column stays silent while a bet is live — the pulsing dot and the
 * countdown beside it already say so twice. Leverage is not a column here: it is
 * Stage 5, and a `1×` on every row would be a number pretending to be a choice.
 * Before lock a one-sided bet carries the plain cash-out (L-35), which Masayume never connected.
 */
export function BetRow({ position, symbol, nowMs, cashOutPreview }: BetRowProps) {
  const state = nowMs > 0 ? countdown(nowMs, position.expirySec, position.intervalSec) : null;
  const settling = state?.settling ?? false;
  const side = heldSide(position.balanceUpRaw, position.balanceDownRaw);

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
        <AssetDisc asset={position.asset} className="bets-mark" />
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
      {!settling &&
        side &&
        (cashOutPreview ? (
          <CashOutLinkView {...cashOutPreview} onCashOut={() => undefined} />
        ) : (
          <CashOutLink marketId={position.marketId} side={side} heldRaw={side === "up" ? position.balanceUpRaw : position.balanceDownRaw} decimals={position.decimals} symbol={symbol} />
        ))}
    </li>
  );
}
