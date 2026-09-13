"use client";

import { formatCadence } from "@masayume/core/market";
import type { EventMarket, MarketId } from "@masayume/core/types";
import { formatClock, remainingSec } from "@masayume/core/units";
import { cn } from "@/lib/utils";
import { SURFACE } from "./copy";

interface SurfaceChipsProps {
  assets: readonly string[];
  asset: string | null;
  onAsset: (asset: string) => void;
  windows: readonly EventMarket[];
  focalId: MarketId | null;
  onFocal: (marketId: MarketId) => void;
  nowMs: number;
}

/**
 * The reference's selectors (`SurfacePage` L200–236): asset pills, then one chip per live market of
 * the asset, nearest expiry first. The reference labels each by days or hours to expiry; Windows
 * here are minutes to a day long, so a chip carries the cadence and the clock.
 */
export function SurfaceChips({ assets, asset, onAsset, windows, focalId, onFocal, nowMs }: SurfaceChipsProps) {
  const { chips } = SURFACE;
  return (
    <div className="sf-chips">
      <div className="sf-chips-group" role="group" aria-label={chips.assets}>
        {assets.map((a) => (
          <button key={a} type="button" className={cn("sf-chip sf-chip--asset", asset === a && "sf-chip--on")} aria-pressed={asset === a} onClick={() => onAsset(a)} data-cursor="hover">
            {a}
          </button>
        ))}
      </div>
      {windows.length > 1 && (
        <>
          <span className="sf-chips-sep" aria-hidden>
            ·
          </span>
          <div className="sf-chips-group" role="group" aria-label={chips.windows}>
            {windows.map((market) => {
              const left = nowMs > 0 ? remainingSec(nowMs, market.expirySec) : 0;
              return (
                <button
                  key={market.marketId}
                  type="button"
                  className={cn("sf-chip sf-chip--window", focalId === market.marketId && "sf-chip--on")}
                  aria-pressed={focalId === market.marketId}
                  onClick={() => onFocal(market.marketId)}
                  data-cursor="hover"
                >
                  {formatCadence(market.intervalSec)}
                  <span className="sf-chip-clock">{left > 0 ? formatClock(left) : "—"}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
