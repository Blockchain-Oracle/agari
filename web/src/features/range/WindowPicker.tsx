"use client";

import { formatCadence } from "@masayume/core/market";
import type { EventMarket, MarketId } from "@masayume/core/types";
import { Countdown } from "@/components/data";
import { cn } from "@/lib/utils";
import { RANGE } from "./copy";
import { usd0 } from "./format";

interface WindowPickerProps {
  windows: EventMarket[];
  loading: boolean;
  pickedId: MarketId | null;
  nowMs: number;
  onPick: (id: MarketId) => void;
}

function WindowRow({ market, on, nowMs, onPick }: { market: EventMarket; on: boolean; nowMs: number; onPick: (id: MarketId) => void }) {
  const { builder } = RANGE;
  return (
    <button type="button" onClick={() => onPick(market.marketId)} className={cn("pl-menu-item", on && "pl-menu-item--on")} aria-pressed={on} data-cursor="hover">
      <span>
        {market.asset} {formatCadence(market.intervalSec)} · {market.openingPriceRaw !== null ? `${builder.opening} ${usd0(market.openingPriceRaw)}` : builder.openingPending}
      </span>
      <span className="pl-menu-when">
        <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />
      </span>
    </button>
  );
}

/** The Windows a reserve round may sit on, as the parlay's menu rows: loading, none, or the list — shared by Range and Moonshot. */
export function WindowPicker({ windows, loading, pickedId, nowMs, onPick }: WindowPickerProps) {
  const { builder } = RANGE;
  if (loading && windows.length === 0) return <div className="pl-loading">{builder.loading}</div>;
  if (windows.length === 0) {
    return (
      <div className="pl-empty">
        <p className="pl-empty-title">{builder.noWindows}</p>
        <p className="pl-empty-body">{builder.noWindowsBody}</p>
      </div>
    );
  }
  return (
    <div className="rg-windows" role="radiogroup" aria-label={builder.pickWindow}>
      {windows.map((w) => (
        <WindowRow key={w.marketId} market={w} on={pickedId === w.marketId} nowMs={nowMs} onPick={onPick} />
      ))}
    </div>
  );
}
