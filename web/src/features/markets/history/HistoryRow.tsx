"use client";

import { formatCadence } from "@masayume/core/copy";
import { roundSettledAtMs, type SettledRound } from "@masayume/core/projection";
import { OUTCOME_TO_SIDE } from "@masayume/core/types";
import { marketDeepLink } from "@masayume/core/urls";
import { txUrl } from "@masayume/core/urls";
import Link from "next/link";
import { Money } from "@/components/data";
import { VAULT } from "@/features/vault";
import { cn } from "@/lib/utils";
import { SIDE_WORD } from "../side-styles";
import { HISTORY } from "./copy";
import { timeAgo } from "./time-ago";

interface HistoryRowProps {
  round: SettledRound;
  symbol: string | undefined;
  /** Chain-corrected clock; 0 before the first client tick, when no relative time is printed. */
  nowMs: number;
  onReceipt: (round: SettledRound) => void;
  /** Settles a vault round into the Trading Balance — permissionless, so the button is offered to whoever is looking. */
  onCrank?: (round: SettledRound) => void;
  cranking?: boolean;
}

/** UP, DOWN, or both — from what was held at expiry, or what was traded when the round closed out early. */
function sidesLabel(round: SettledRound): string {
  const sides = round.legs.length > 0 ? round.legs.map((leg) => leg.outcomeIdx) : round.sidesTraded;
  return sides.map((idx) => SIDE_WORD[OUTCOME_TO_SIDE[idx]]).join(" + ");
}

/**
 * One settled Window, ported from the reference's history rows (`Portfolio624Section` L486–512):
 * the outcome word, what it paid, how long ago, then the receipt and the proof link.
 *
 * The loss is printed in the same ink as everything else — a fact, not an alarm. The only
 * profit/loss colour on the row is the net figure, by the colour law.
 */
export function HistoryRow({ round, symbol, nowMs, onReceipt, onCrank, cranking = false }: HistoryRowProps) {
  const settledAtMs = roundSettledAtMs(round);
  const claimLine = HISTORY.claim[round.claim];
  const vault = round.source === "vault";

  return (
    <li className="bets-row history-row">
      <span className={cn("type-label-micro shrink-0", round.outcome === "win" ? "text-ink" : "text-ink-secondary")}>{HISTORY.outcome[round.outcome]}</span>

      <Link href={marketDeepLink({ marketId: round.marketId })} data-cursor="hover" className="type-body-strong text-ink">
        {round.asset} {sidesLabel(round)}
      </Link>
      <span className="type-label-micro text-ink-muted">{formatCadence(round.intervalSec)}</span>
      {vault && <span className="type-label-micro text-accent">{VAULT.rounds.via}</span>}

      {round.payoutBase > 0n && (
        <span className="type-caption text-ink-secondary">
          {HISTORY.paid} <Money value={round.payoutBase} decimals={round.decimals} symbol={symbol} />
        </span>
      )}
      {round.claim === "to-collect" && vault ? (
        <button type="button" onClick={() => onCrank?.(round)} disabled={cranking || !onCrank} data-cursor="hover" className="type-label-micro text-accent">
          {cranking ? VAULT.rounds.cranking : VAULT.rounds.crank}
        </button>
      ) : round.claim === "to-collect" ? (
        <Link href={marketDeepLink({ marketId: round.marketId })} data-cursor="hover" className="type-label-micro text-accent">
          {claimLine} · {HISTORY.collectLink}
        </Link>
      ) : (
        claimLine && <span className="type-label-micro text-ink-muted">{claimLine}</span>
      )}
      {round.shortCount > 0 && <span className="type-caption text-ink-muted">{HISTORY.shorted}</span>}

      <span className="bets-break" aria-hidden />
      <span className="flex-1" />

      {nowMs > 0 && <span className="type-caption text-ink-muted numbers">{timeAgo(settledAtMs, nowMs)}</span>}
      <Money value={round.pnlBase} decimals={round.decimals} tone="pnl" className="type-data shrink-0" />
      <button type="button" onClick={() => onReceipt(round)} data-cursor="hover" className="history-receipt-button type-label-micro">
        {HISTORY.receipt} ↗
      </button>
      {!vault && (
        <a href={txUrl(round.entryTxHash)} target="_blank" rel="noreferrer" title={HISTORY.entryTx} className="history-proof-link numbers">
          ↗
        </a>
      )}
    </li>
  );
}
