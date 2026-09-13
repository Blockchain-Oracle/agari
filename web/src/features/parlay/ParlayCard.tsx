"use client";

import { SETTLING } from "@masayume/core/copy";
import { formatCadence } from "@masayume/core/market";
import type { ParlayLegStatus, ParlayStatus } from "@masayume/core/parlay";
import { formatBaseUnits, formatClock, remainingSec } from "@masayume/core/units";
import { Check, Clock, Layers, Loader2, Minus, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PARLAY } from "./copy";
import { formatLineShort, formatMultiplierTenths } from "./format";
import type { ParlayBusyKey } from "./useParlayWrites";
import type { ParlayLegView, ParlayTicketView } from "./useParlayTickets";

interface ParlayCardProps {
  ticket: ParlayTicketView;
  nowMs: number;
  symbol: string;
  decimals: number;
  busy: ParlayBusyKey | null;
  onClaim: (ticket: ParlayTicketView) => void;
  onSettle: (ticket: ParlayTicketView, legIdx: number) => void;
}

const DOT_ICON: Record<ParlayLegStatus, () => React.ReactNode> = {
  won: () => <Check size={12} strokeWidth={3} />,
  lost: () => <X size={12} strokeWidth={3} />,
  void: () => <Minus size={12} strokeWidth={3} />,
  pending: () => <Clock size={11} />,
};

function LegRow({ leg, idx, nowMs, busyHere, onSettle }: { leg: ParlayLegView; idx: number; nowMs: number; busyHere: boolean; onSettle: () => void }) {
  const { slip } = PARLAY;
  const left = nowMs > 0 ? remainingSec(nowMs, leg.expirySec) : null;
  return (
    <div className="pl-cleg">
      <span className="pl-cleg-idx">{String(idx + 1).padStart(2, "0")}</span>
      <span className={cn("pl-cleg-dot", leg.status !== "pending" && `pl-cleg-dot--${leg.status}`)}>{DOT_ICON[leg.status]()}</span>
      <div className="pl-cleg-main">
        <div className="pl-cleg-name">
          {leg.asset ?? "…"} {leg.intervalSec !== null && formatCadence(leg.intervalSec)}{" "}
          <span className={leg.side === "up" ? "pl-cleg-side--up" : "pl-cleg-side--down"}>{leg.side === "up" ? "UP" : "DOWN"}</span>
          {leg.openingPriceRaw !== null && <span className="pl-cleg-line"> · {formatLineShort(leg.openingPriceRaw)}</span>}
        </div>
      </div>
      <span className={cn("pl-cleg-state", `pl-cleg-state--${leg.status === "won" ? "won" : leg.status === "pending" ? "pending" : "lost"}`)}>
        {leg.status === "won" && slip.legWon}
        {leg.status === "lost" && slip.legMissed}
        {leg.status === "void" && slip.legVoid}
        {leg.status === "pending" &&
          (leg.settledOnchain ? (
            <button type="button" onClick={onSettle} disabled={busyHere} className="pl-settle" data-cursor="hover">
              {busyHere ? slip.settling : slip.settle}
            </button>
          ) : left === null ? (
            "–:––"
          ) : left === 0 ? (
            SETTLING
          ) : (
            formatClock(left)
          ))}
      </span>
    </div>
  );
}

function StatusPill({ status, wonCount, total }: { status: ParlayStatus; wonCount: number; total: number }) {
  const { slip } = PARLAY;
  if (status === "won" || status === "claimed") return <span className="pl-pill pl-pill--won">{status === "won" ? slip.won : slip.paid}</span>;
  if (status === "lost" || status === "void") return <span className="pl-pill pl-pill--dead">{status === "lost" ? slip.dead : slip.voided}</span>;
  return <span className="pl-pill">{slip.inPlay(wonCount, total)}</span>;
}

/** One ticket on the slip (`ParlaySlip.tsx` L65–132): the streak, its pill, the multiplier, the legs, then the claim or the verdict. */
export function ParlayCard({ ticket, nowMs, symbol, decimals, busy, onClaim, onSettle }: ParlayCardProps) {
  const { slip } = PARLAY;
  const { status } = ticket;
  const lost = status === "lost";
  const claiming = busy === `claim:${ticket.parlayId}`;
  const payout = formatBaseUnits(ticket.maxPayoutBase, decimals);
  return (
    <div className={cn("pl-card pl-rise", status === "won" && "pl-card--won", (lost || status === "void") && "pl-card--lost")}>
      <div className="pl-card-head">
        <div className="pl-card-name">
          <Layers size={14} />
          <span className="pl-card-streak">{slip.streak(ticket.legs.length)}</span>
          <StatusPill status={status} wonCount={ticket.wonCount} total={ticket.legs.length} />
        </div>
        <div className="pl-card-right">
          <div className="pl-card-x">{formatMultiplierTenths(Number((ticket.maxPayoutBase * 1000n) / (ticket.stakeBase || 1n)))}</div>
          <div className="pl-card-sub">
            {formatBaseUnits(ticket.stakeBase, decimals)} → {payout}
          </div>
        </div>
      </div>

      <div className="pl-card-legs">
        {ticket.legs.map((leg, i) => (
          <LegRow key={i} leg={leg} idx={i} nowMs={nowMs} busyHere={busy === `settle:${ticket.parlayId}:${i}`} onSettle={() => onSettle(ticket, i)} />
        ))}
      </div>

      {status === "won" && (
        <button type="button" onClick={() => onClaim(ticket)} disabled={claiming} className="pl-claim" data-cursor="hover">
          {claiming ? <Loader2 size={15} className="animate-spin" /> : <Trophy size={15} />}
          {claiming ? slip.claiming : slip.claim(payout, symbol)}
        </button>
      )}
      {lost && <p className="pl-card-note">{slip.lost}</p>}
      {status === "void" && <p className="pl-card-note">{slip.voidedNote}</p>}
      {status === "claimed" && <p className="pl-card-note">{slip.paidNote}</p>}
    </div>
  );
}
