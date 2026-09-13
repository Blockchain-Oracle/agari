"use client";

import type { RangeSide } from "@masayume/core/range";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { RANGE } from "./copy";
import { usdOnGrid } from "./format";
import { RANGE_PRESETS, bandHalfUsd } from "./presets";
import type { RangeDraft } from "./useRangeDraft";

interface BandControlProps {
  asset: string;
  intervalSec: number;
  draft: RangeDraft;
  side: RangeSide;
  /** The reference's Ticket has inside only; the game page offers both. */
  onSide?: (side: RangeSide) => void;
}

/**
 * The reference's range body (`Ticket624Drawer.tsx` L900–1030): explicit bounds, a draggable centre on a
 * track with the spot marked, three width presets scaled per cadence, and centre steps on the asset's grid
 * (the reference's five dollars on BTC).
 */
export function BandControl({ asset, intervalSec, draft, side, onSide }: BandControlProps) {
  const { band } = RANGE;
  const { spotUsd, lowUsd, highUsd, offset, centerMax, dragging, axisHalf, unit, decimals } = draft;
  const ready = spotUsd !== null && lowUsd !== null && highUsd !== null;
  const usd = (n: number) => usdOnGrid(n, decimals);
  const pct = (v: number) => (spotUsd === null ? 0 : Math.max(0, Math.min(100, ((v - (spotUsd - axisHalf)) / (axisHalf * 2)) * 100)));
  const above = offset > 0;
  const step = usd(unit);

  return (
    <div className="rg-band">
      <div className="rg-band-head">
        <span className="rg-band-label">{band.label}</span>
        <span className="rg-band-must">{band.mustFinish(asset, side)}</span>
      </div>

      <div className="rg-band-card" aria-live="polite">
        {ready ? (
          <>
            <div className="rg-band-bounds">
              <div>
                <span className="rg-k">{band.from}</span>
                <strong className="rg-band-v">{usd(lowUsd)}</strong>
              </div>
              <span className="rg-band-arrow" aria-hidden="true">
                →
              </span>
              <div className="rg-band-right">
                <span className="rg-k">{band.to}</span>
                <strong className="rg-band-v">{usd(highUsd)}</strong>
              </div>
            </div>
            <div ref={draft.trackRef} className="rg-track">
              <div className="rg-track-line" />
              <div
                role="slider"
                tabIndex={0}
                aria-label={band.sliderLabel(asset)}
                aria-valuemin={-centerMax}
                aria-valuemax={centerMax}
                aria-valuenow={offset}
                aria-valuetext={offset === 0 ? band.sliderCentered : band.sliderOff(usd(Math.abs(offset)), above)}
                title={band.drag}
                className={cn("rg-thumb", dragging && "rg-thumb--dragging")}
                style={{ left: `${pct(lowUsd)}%`, right: `${100 - pct(highUsd)}%` }}
                onPointerDown={draft.onPointerDown}
                onPointerMove={draft.onPointerMove}
                onPointerUp={draft.onPointerEnd}
                onPointerCancel={draft.onPointerEnd}
                onLostPointerCapture={draft.onPointerEnd}
                onKeyDown={draft.onKeyDown}
              >
                <span className="rg-thumb-fill" />
                <span className="rg-thumb-grip" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
              <div className="rg-spot-tick" style={{ left: `${pct(spotUsd)}%` }} />
              <div className="rg-spot-dot" style={{ left: `${pct(spotUsd)}%` }} />
            </div>
            <div className="rg-band-foot">
              <span>{band.now(asset)}</span>
              <span className="rg-band-foot-v">{usd(spotUsd)}</span>
            </div>
          </>
        ) : (
          <div className="rg-band-wait">{band.waiting}</div>
        )}
      </div>

      <div className="rg-presets" aria-label={band.width}>
        {RANGE_PRESETS.map((p) => {
          const on = draft.preset === p.key;
          return (
            <button key={p.key} type="button" onClick={() => draft.setPreset(p.key)} className="rg-preset" aria-pressed={on} data-cursor="hover">
              <span className="rg-preset-name">{band.presetLabel(p.key, p.label)}</span>
              <span className={cn("rg-preset-span", on && "rg-preset-span--on")}>{band.span(usd(bandHalfUsd(p.key, intervalSec, spotUsd) * 2))}</span>
            </button>
          );
        })}
      </div>

      <div className="rg-center">
        <div className="rg-center-text">
          <span className="rg-k">{band.center}</span>
          <span className="rg-center-v">{offset === 0 ? band.atMarket : band.offMarket(usd(Math.abs(offset)), above)}</span>
        </div>
        <div className="rg-center-btns">
          <button type="button" onClick={() => draft.nudge(-1)} className="rg-icon-btn" aria-label={band.lower(step)} title={band.lowerTitle(step)}>
            <Minus />
          </button>
          <button type="button" onClick={draft.recenter} disabled={offset === 0} className="rg-icon-btn" aria-label={band.recenter} title={band.recenterTitle}>
            <RotateCcw />
          </button>
          <button type="button" onClick={() => draft.nudge(1)} className="rg-icon-btn" aria-label={band.higher(step)} title={band.higherTitle(step)}>
            <Plus />
          </button>
        </div>
      </div>

      {onSide && (
        <div className="rg-sides" role="radiogroup" aria-label={band.sideLabel}>
          {(["inside", "outside"] as const).map((option) => (
            <button key={option} type="button" role="radio" aria-checked={side === option} onClick={() => onSide(option)} className="rg-side" data-cursor="hover">
              {option === "inside" ? band.inside : band.outside}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
