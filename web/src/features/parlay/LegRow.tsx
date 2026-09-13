"use client";

import { formatCadence } from "@masayume/core/market";
import type { EventMarket, MarketId, Side } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { ChevronDown, TrendingDown, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { Countdown } from "@/components/data";
import { cn } from "@/lib/utils";
import { PARLAY } from "./copy";
import { formatBpsPct, formatLine, type ThinBook } from "./format";

export interface DraftLeg {
  key: string;
  marketId: MarketId;
  /** The lane the leg lives on, so it can follow the lane when its Window rolls. */
  asset: string;
  intervalSec: number;
  side: Side;
}

interface LegRowProps {
  index: number;
  leg: DraftLeg;
  /** The Window the leg names, or null once it has left the live set. */
  market: EventMarket | null;
  windows: readonly EventMarket[];
  legProbBps: number | null;
  /** The reserve's `ThinBook` for this leg's Window, when that is why the ticket has no price. */
  thin: ThinBook | null;
  decimals: number;
  nowMs: number;
  onPatch: (key: string, patch: Partial<DraftLeg>) => void;
  onRemove: (key: string) => void;
}

/**
 * One leg (`ParlayBuilder.tsx` L591–745): the numbered stamp, the Window picker, remove, the
 * Up/Down pair, the line, the live per-leg probability. The reference's strike picker becomes a
 * read-only line here — on DreamDEX a Window's line is its opening print, not something to choose.
 */
export function LegRow({ index, leg, market, windows, legProbBps, thin, decimals, nowMs, onPatch, onRemove }: LegRowProps) {
  const [showWindows, setShowWindows] = useState(false);
  const { builder } = PARLAY;

  const choose = (next: EventMarket) => {
    onPatch(leg.key, { marketId: next.marketId, asset: next.asset, intervalSec: next.intervalSec });
    setShowWindows(false);
  };

  return (
    <div className={cn("pl-leg pl-rise", showWindows && "pl-leg--open")}>
      <div className="pl-leg-inner">
        <div className="pl-leg-stamp">
          <span className="pl-leg-num">{index + 1}</span>
        </div>

        <div className="pl-leg-main">
          <div className="pl-leg-row">
            <div className="pl-picker">
              <button type="button" onClick={() => setShowWindows((s) => !s)} className="pl-picker-btn" aria-expanded={showWindows} aria-label={builder.pickWindow} data-cursor="hover">
                <span className="pl-picker-label">
                  {market ? (
                    <>
                      {market.asset} {formatCadence(market.intervalSec)} · <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />
                    </>
                  ) : (
                    builder.settled
                  )}
                </span>
                <ChevronDown className={cn("pl-chevron", showWindows && "pl-chevron--open")} />
              </button>
              {showWindows && (
                <div className="pl-menu pl-drop" role="listbox">
                  {windows.length === 0 && <div className="pl-menu-empty">{builder.noMarkets}</div>}
                  {windows.map((w) => (
                    <button
                      key={w.marketId}
                      type="button"
                      role="option"
                      aria-selected={w.marketId === leg.marketId}
                      onClick={() => choose(w)}
                      className={cn("pl-menu-item", w.marketId === leg.marketId && "pl-menu-item--on")}
                    >
                      <span>
                        {w.asset} {formatCadence(w.intervalSec)}
                      </span>
                      <span className="pl-menu-when">
                        <Countdown expirySec={w.expirySec} intervalSec={w.intervalSec} nowMs={nowMs} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => onRemove(leg.key)} className="pl-remove" aria-label={builder.remove} data-cursor="hover">
              <X />
            </button>
          </div>

          <div className="pl-leg-row">
            <div className="pl-sides">
              <button type="button" onClick={() => onPatch(leg.key, { side: "up" })} className="pl-side pl-side--up" aria-pressed={leg.side === "up"} data-cursor="up">
                <TrendingUp /> {builder.up}
              </button>
              <button type="button" onClick={() => onPatch(leg.key, { side: "down" })} className="pl-side pl-side--down" aria-pressed={leg.side === "down"} data-cursor="hover">
                <TrendingDown /> {builder.down}
              </button>
            </div>

            <div className="pl-line">
              <span className="pl-line-label">{builder.line}</span>
              {market?.openingPriceRaw != null ? (
                <span className="pl-picker-label pl-picker-label--bold">{formatLine(market.openingPriceRaw)}</span>
              ) : (
                <span className="pl-line-pending">{market ? builder.linePending : "···"}</span>
              )}
            </div>

            {thin ? (
              <span className="pl-prob pl-prob--thin">{builder.thin(formatBaseUnits(thin.filledRaw, decimals, { minDp: 0, maxDp: 2 }), formatBaseUnits(thin.depthRaw, decimals, { minDp: 0, maxDp: 2 }))}</span>
            ) : (
              <span className="pl-prob">{legProbBps !== null ? formatBpsPct(legProbBps) : "·"}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
