"use client";

import type { TraderEdge, WalletHistory } from "@masayume/core/projection";
import { DownloadIcon } from "lucide-react";
import { Money } from "@/components/data";
import { Button } from "@/components/ui/button";
import { HISTORY } from "./copy";
import { EquitySparkline } from "./EquitySparkline";
import { useCsvDownload } from "./useCsvDownload";

interface HistorySummaryProps {
  history: WalletHistory;
  edge: TraderEdge;
  address: string;
  symbol: string | undefined;
}

/**
 * The record in one strip: net over every settled Window, the curve that produced it, the win
 * rate and the run the wallet is on — then the same rows as a file. Nothing here is computed
 * twice: the strip reads the report Trader Edge reads.
 */
export function HistorySummary({ history, edge, address, symbol }: HistorySummaryProps) {
  const download = useCsvDownload(history.rounds, address);
  const noRounds = history.rounds.length === 0;

  return (
    <div className="history-summary">
      <div className="history-summary-figure">
        <span className="type-label-micro text-ink-muted">{HISTORY.summary.net}</span>
        <Money value={edge.netBase} decimals={history.decimals} symbol={symbol} tone="pnl" className="type-data-lg" />
        <span className="type-caption text-ink-secondary">{HISTORY.summary.rounds(edge.settledRounds, edge.openRounds)}</span>
      </div>
      <EquitySparkline points={edge.equity} decimals={history.decimals} className="history-summary-curve" />
      <dl className="history-summary-stats">
        <div>
          <dt className="type-label-micro text-ink-muted">{HISTORY.summary.winRate}</dt>
          <dd className="type-data text-ink">{edge.winRatePct === null ? HISTORY.summary.notYet : `${edge.winRatePct.toFixed(0)}%`}</dd>
        </div>
        <div>
          <dt className="type-label-micro text-ink-muted">{HISTORY.summary.streak}</dt>
          <dd className="type-data text-ink">
            {edge.currentWinStreak} {HISTORY.summary.streakUnit(edge.currentWinStreak)}
          </dd>
        </div>
      </dl>
      <Button variant="outline" size="sm" onClick={download} disabled={noRounds} className="history-summary-csv">
        <DownloadIcon data-icon="inline-start" />
        {HISTORY.csv}
      </Button>
    </div>
  );
}
