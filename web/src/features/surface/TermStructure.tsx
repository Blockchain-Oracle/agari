"use client";

import type { TermPoint } from "@masayume/core/surface";
import type { MarketId } from "@masayume/core/types";
import { bpsToOddsCents } from "@masayume/core/units";
import { Countdown } from "@/components/data";
import { StaleTick } from "@/components/states";
import { cn } from "@/lib/utils";
import { oraclePriceText } from "../markets/hero/OraclePrice";
import { SURFACE } from "./copy";
import { centsText, contractsText } from "./format";
import { TermChart } from "./TermChart";

interface TermStructureProps {
  points: readonly TermPoint[];
  decimals: number;
  nowMs: number;
  focalId: MarketId | null;
  onPick: (marketId: MarketId) => void;
}

const price = (bps: number | null) => (bps === null ? "—" : `${bpsToOddsCents(bps)}¢`);

function Row({ point, decimals, nowMs, focal, onPick }: { point: TermPoint; decimals: number; nowMs: number; focal: boolean; onPick: (marketId: MarketId) => void }) {
  const copy = SURFACE.term;
  const s = point.structure;
  return (
    <button type="button" className={cn("sf-trow", focal && "sf-trow--focal")} aria-pressed={focal} onClick={() => onPick(point.marketId)} data-cursor="hover">
      <span className="sf-trow-window">
        <b>{point.cadence}</b> {point.asset}
      </span>
      <span className="sf-row-num">
        <Countdown expirySec={point.expirySec} intervalSec={point.intervalSec} nowMs={nowMs} />
      </span>
      <span className="sf-row-num">{oraclePriceText(point.openingPriceRaw)}</span>
      <span className="sf-row-num sf-trow-up">{s ? price(s.upAskBps) : "…"}</span>
      <span className="sf-row-num">{s ? price(s.downAskBps) : "…"}</span>
      <span className="sf-row-num">{!s ? "…" : s.crossed ? <span className="sf-trow-crossed">{copy.crossed}</span> : s.spreadBps === null ? "—" : centsText(s.spreadBps)}</span>
      <span className="sf-row-num">{s ? `${contractsText(s.upBidDepthRaw, decimals)} / ${contractsText(s.upAskDepthRaw, decimals)}` : "…"}</span>
      <span className="sf-trow-state">{point.unavailable ? copy.unavailable : point.stale ? <StaleTick asOfMs={0} compact /> : s && s.levels === 0 ? SURFACE.tiles.empty : ""}</span>
    </button>
  );
}

/**
 * §04 — the curve, then the same Windows as rows: cadence, the clock, the line each settles
 * against, what each side costs, the spread and the depth. Every row is a real live Window of the
 * asset; a book still hydrating reads "…", one whose read failed says so, and nothing is filled in.
 */
export function TermStructure({ points, decimals, nowMs, focalId, onPick }: TermStructureProps) {
  const { columns } = SURFACE.term;
  return (
    <div className="sf-termwrap">
      <TermChart points={points} focalId={focalId} onPick={onPick} />
      <div className="sf-box sf-box--table sf-ttable">
        <div className="sf-trow sf-trow--head">
          <span>{columns.window}</span>
          <span className="sf-row-num">{columns.closes}</span>
          <span className="sf-row-num">{columns.print}</span>
          <span className="sf-row-num">{columns.up}</span>
          <span className="sf-row-num">{columns.down}</span>
          <span className="sf-row-num">{columns.spread}</span>
          <span className="sf-row-num">{columns.depth}</span>
          <span>{columns.state}</span>
        </div>
        {points.map((point) => (
          <Row key={point.marketId} point={point} decimals={decimals} nowMs={nowMs} focal={point.marketId === focalId} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
