"use client";

import { countdown } from "@masayume/core/lifecycle";
import { marketDeepLink } from "@masayume/core/urls";
import Link from "next/link";
import { Countdown, Money } from "@/components/data";
import { formatCadence, PORTFOLIO } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { SIDE_WORD } from "../markets/side-styles";
import { VAULT } from "./copy";
import type { VaultOpenBet } from "./useVaultOpenBets";

interface VaultBetRowProps {
  bet: VaultOpenBet;
  symbol: string | undefined;
  nowMs: number;
}

function sideLabel(bet: VaultOpenBet): string {
  const up = bet.heldUpRaw > 0n;
  const down = bet.heldDownRaw > 0n;
  if (up && down) return PORTFOLIO.bothSides;
  return up ? SIDE_WORD.up : SIDE_WORD.down;
}

/**
 * One open bet the vault holds — `BetRow`'s grammar (reference `Portfolio624Section` L431) with
 * the seat named. No "worth now": the venue prices a wallet's positions, not the vault's per
 * owner, so the row says what was staked and says why that is all it says.
 */
export function VaultBetRow({ bet, symbol, nowMs }: VaultBetRowProps) {
  const state = nowMs > 0 ? countdown(nowMs, bet.expirySec, bet.intervalSec) : null;
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
      <Link href={marketDeepLink({ marketId: bet.marketId })} data-cursor="hover" className="type-body-strong text-ink">
        {bet.asset} {sideLabel(bet)}
      </Link>
      <span className="type-label-micro text-ink-muted">{formatCadence(bet.intervalSec)}</span>
      <span className="type-label-micro text-accent">{VAULT.bets.from}</span>
      {!settling && (
        <span className="type-caption text-ink-secondary">
          <Countdown expirySec={bet.expirySec} intervalSec={bet.intervalSec} nowMs={nowMs} /> {PORTFOLIO.left}
        </span>
      )}
      <span className="bets-break" aria-hidden />
      <span className="flex-1" />
      <span className="type-caption text-ink-secondary">
        {VAULT.bets.staked} <Money value={bet.stakeBase} decimals={bet.decimals} symbol={symbol} />
      </span>
      <span className="type-caption text-ink-muted">{VAULT.bets.unpriced}</span>
    </li>
  );
}
