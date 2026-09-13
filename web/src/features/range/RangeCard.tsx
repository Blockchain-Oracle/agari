"use client";

import { SETTLING } from "@masayume/core/copy";
import { formatCadence } from "@masayume/core/market";
import type { RangeRoundStatus } from "@masayume/core/range";
import { formatBaseUnits, formatClock, remainingSec } from "@masayume/core/units";
import { Loader2, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { RANGE } from "./copy";
import { formatMultiplierTenths, usdBand, usd2 } from "./format";
import type { RangeRoundView } from "./useRangeRounds";
import type { RangeBusyKey } from "./useRangeWrites";

interface RangeCardProps {
  round: RangeRoundView;
  nowMs: number;
  symbol: string;
  decimals: number;
  /** The reserve's grace after expiry before a round the hub never answered may be voided. */
  staleAfterSec: number;
  busy: RangeBusyKey | null;
  onClaim: (round: RangeRoundView) => void;
  onSettle: (round: RangeRoundView) => void;
  onVoidStale: (round: RangeRoundView) => void;
}

function StatusPill({ status }: { status: RangeRoundStatus }) {
  const { slip } = RANGE;
  if (status === "won" || status === "claimed") return <span className="pl-pill pl-pill--won">{status === "won" ? slip.won : slip.paid}</span>;
  if (status === "lost" || status === "void") return <span className="pl-pill pl-pill--dead">{status === "lost" ? slip.lost : slip.voided}</span>;
  return <span className="pl-pill">{slip.inPlay}</span>;
}

/** One round on the slip, in the parlay card's grammar: the Window, its pill, the multiple, the band, the print, then the crank, the claim or the verdict. */
export function RangeCard({ round, nowMs, symbol, decimals, staleAfterSec, busy, onClaim, onSettle, onVoidStale }: RangeCardProps) {
  const { slip } = RANGE;
  const { status } = round;
  const dead = status === "lost" || status === "void";
  const left = nowMs > 0 ? remainingSec(nowMs, round.expirySec) : null;
  const expired = left === 0;
  const stale = nowMs > 0 && Math.floor(nowMs / 1000) >= round.expirySec + staleAfterSec;
  const settling = busy === `settle:${round.roundId}`;
  const voiding = busy === `void:${round.roundId}`;
  const claiming = busy === `claim:${round.roundId}`;
  const payout = formatBaseUnits(round.maxPayoutBase, decimals);
  const inside = round.closingPrint !== null && round.closingPrint >= round.lowPrint && round.closingPrint <= round.highPrint;
  const { kind } = round;
  // A Moonshot is one edge, not two: "above $K" for a LONG, "below $K" for a SHORT (the other edge saturates).
  const what = kind.kind === "moonshot" ? slip.target(kind.direction, usdBand(kind.strikePrint)) : slip.band(usdBand(round.lowPrint), usdBand(round.highPrint), round.side);
  const closedLine = round.closingPrint === null ? null : kind.kind === "moonshot" ? slip.closedTarget(usd2(round.closingPrint), inside) : slip.closed(usd2(round.closingPrint), inside);

  return (
    <div className={cn("pl-card pl-rise", status === "won" && "pl-card--won", dead && "pl-card--lost")}>
      <div className="pl-card-head">
        <div className="pl-card-name">
          <Target size={14} />
          <span className="pl-card-streak">{slip.round(round.asset ?? "…", round.intervalSec !== null ? formatCadence(round.intervalSec) : "")}</span>
          <StatusPill status={status} />
        </div>
        <div className="pl-card-right">
          <div className="pl-card-x">{formatMultiplierTenths(Number((round.maxPayoutBase * 1000n) / (round.stakeBase || 1n)))}</div>
          <div className="pl-card-sub">
            {formatBaseUnits(round.stakeBase, decimals)} → {payout}
          </div>
        </div>
      </div>

      <div className="pl-card-legs">
        <div className="pl-cleg">
          <div className="pl-cleg-main">
            <div className="pl-cleg-name">
              <span className="rg-card-side">{what}</span>
              <span className="pl-cleg-line"> · {slip.opening(usd2(round.openingPrint))}</span>
            </div>
            {closedLine && <div className="rg-card-close">{closedLine}</div>}
          </div>
          <span className={cn("pl-cleg-state", status === "won" || status === "claimed" ? "pl-cleg-state--won" : status === "live" ? "pl-cleg-state--pending" : "pl-cleg-state--lost")}>
            {status === "live" &&
              (expired || round.settledOnchain ? (
                <>
                  <button type="button" onClick={() => onSettle(round)} disabled={settling || voiding} className="pl-settle" data-cursor="hover">
                    {settling ? slip.settling : slip.settle}
                  </button>
                  {stale && (
                    <button type="button" onClick={() => onVoidStale(round)} disabled={settling || voiding} className="pl-settle" data-cursor="hover">
                      {voiding ? slip.voiding : slip.voidStale}
                    </button>
                  )}
                </>
              ) : left === null ? (
                "–:––"
              ) : left === 0 ? (
                SETTLING
              ) : (
                formatClock(left)
              ))}
            {status === "won" && slip.won}
            {status === "lost" && slip.lost}
            {status === "void" && slip.voided}
            {status === "claimed" && slip.paid}
          </span>
        </div>
      </div>

      {status === "won" && (
        <button type="button" onClick={() => onClaim(round)} disabled={claiming} className="pl-claim" data-cursor="hover">
          {claiming ? <Loader2 size={15} className="animate-spin" /> : <Trophy size={15} />}
          {claiming ? slip.claiming : slip.claim(payout, symbol)}
        </button>
      )}
      {status === "lost" && <p className="pl-card-note">{slip.lostNote}</p>}
      {status === "void" && <p className="pl-card-note">{slip.voidedNote}</p>}
      {status === "claimed" && <p className="pl-card-note">{slip.paidNote}</p>}
    </div>
  );
}
