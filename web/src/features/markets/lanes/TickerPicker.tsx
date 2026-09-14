"use client";

import type { TickerSymbol } from "@agari/core/market";
import { MARKETS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { AssetDisc } from "../hero/asset-mark";
import "./ticker-picker.css";

interface TickerPickerProps {
  /** Every ticker worth a tab: listed in the lane, paused by the roller, or pinned. Registry order. */
  tickers: readonly TickerSymbol[];
  paused: ReadonlySet<TickerSymbol>;
  ticker: TickerSymbol | null;
  onPick: (ticker: TickerSymbol | null) => void;
}

/**
 * Filters the active lane by ticker (first-call.md §6). A lane carries up to nine tickers where
 * Masayume's carried two, so "All" is the reference's own view and each tab narrows it. The pin
 * (`agari.ticker`) survives a cadence switch and a reload, and the hero follows it.
 */
export function TickerPicker({ tickers, paused, ticker, onPick }: TickerPickerProps) {
  return (
    <div className="asset-tabs tkp" role="group" aria-label={MARKETS.tickers.group}>
      <button type="button" className={cn("asset-tab", ticker === null && "active")} aria-pressed={ticker === null} onClick={() => onPick(null)} data-cursor="hover">
        {MARKETS.tickers.all}
      </button>
      {tickers.map((symbol) => {
        const isPaused = paused.has(symbol);
        return (
          <button
            key={symbol}
            type="button"
            className={cn("asset-tab", ticker === symbol && "active")}
            aria-pressed={ticker === symbol}
            data-paused={isPaused}
            title={isPaused ? MARKETS.paused.noSource : undefined}
            onClick={() => onPick(symbol)}
            data-cursor="hover"
          >
            <AssetDisc asset={symbol} className="glyph" />
            {symbol}
          </button>
        );
      })}
    </div>
  );
}
