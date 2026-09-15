"use client";

import { TICKER_SYMBOLS, TICKERS } from "@agari/core/market";
import { TickerPicker } from "@/features/markets/lanes/TickerPicker";
import { cn } from "@/lib/utils";
import { LEADERBOARD } from "./copy";
import type { BoardQuery } from "./leaderboard-client";
import { BOARD_PERIODS } from "./protocol";
import "./board-filters.css";

interface BoardFiltersProps {
  board: BoardQuery;
  onBoard: (board: BoardQuery) => void;
  /** The filter meta: closed calls and how much of the period the scan covers. */
  meta: string;
}

const NO_PAUSES: ReadonlySet<never> = new Set();
/** The Regular lane's tickers, registry order (SPY waits for a signed source). */
const BOARD_TICKERS = TICKER_SYMBOLS.filter((symbol) => TICKERS[symbol].launch);

/**
 * Masayume's filter bar (`LeaderboardBoard.tsx`: "All assets" and "Last 24 hours" as static `.asset-tab` spans), made
 * live: the period tabs keep that exact look, and the tickers are the picker `/markets` already uses (the same
 * `.asset-tabs`). Yosuku drew periods and assets as two groups in one bar (`app/leaderboard/page.tsx` L215–241).
 */
export function BoardFilters({ board, onBoard, meta }: BoardFiltersProps) {
  return (
    <div className="lb-filter-bar">
      <div className="asset-tabs lb-periods" role="group" aria-label={LEADERBOARD.hero.periodGroup}>
        {BOARD_PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            className={cn("asset-tab", board.period === period && "active")}
            aria-pressed={board.period === period}
            onClick={() => onBoard({ ...board, period })}
            data-cursor="hover"
          >
            {LEADERBOARD.hero.periods[period]}
          </button>
        ))}
      </div>
      <TickerPicker tickers={BOARD_TICKERS} paused={NO_PAUSES} ticker={board.ticker} onPick={(ticker) => onBoard({ ...board, ticker })} />
      <div className="lb-filter-meta">{meta}</div>
    </div>
  );
}
