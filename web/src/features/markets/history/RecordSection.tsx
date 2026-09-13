"use client";

import { computeBadges, computeTraderEdge, reputationOf } from "@masayume/core/projection";
import { isOk } from "@masayume/core/schemas";
import { useMakerShares, useMakerVault } from "@masayume/markets/react";
import { useMemo } from "react";
import { SectionHeader } from "@/components/chrome";
import { ReadingBoundary } from "@/components/states";
import { HISTORY } from "./copy";
import { HistorySummary } from "./HistorySummary";
import { ReputationPanel } from "./ReputationPanel";
import type { HistoryReading } from "./useHistoryReading";

interface RecordSectionProps {
  history: HistoryReading;
  symbol: string | undefined;
  index: string;
}

/** §Your record: the summary strip, then reputation and badges — all three read the one projection. */
export function RecordSection({ history, symbol, index }: RecordSectionProps) {
  const value = history.reading?.ok ? history.reading.value : null;
  // The LP badge is the reference's PLP balance: here, shares of the maker vault (null where none is deployed).
  const vault = useMakerVault();
  const shares = useMakerShares(history.address);
  const lpSharesRaw = vault && isOk(vault) ? (vault.value === null ? null : shares && isOk(shares) ? shares.value.shares : 0n) : 0n;
  const derived = useMemo(() => {
    if (!value) return null;
    const edge = computeTraderEdge(value.rounds, value.openCount);
    const decided = edge.wins + edge.losses;
    const winRate = decided > 0 ? edge.wins / decided : 0;
    return {
      edge,
      reputation: reputationOf(decided, edge.wins, edge.currentWinStreak),
      badges: computeBadges({ fillCount: value.fillCount, currentWinStreak: edge.currentWinStreak, stakeBase: edge.stakeBase, decidedRounds: decided, winRate, decimals: value.decimals, lpSharesRaw }),
    };
  }, [value, lpSharesRaw]);

  return (
    <section className="flex flex-col gap-4" aria-label={HISTORY.summary.title}>
      <SectionHeader index={index} title={HISTORY.summary.title} />
      <ReadingBoundary reading={history.reading} shape="plate" retry={history.retry}>
        {(read) =>
          derived && history.address ? (
            <div className="flex flex-col gap-6">
              <HistorySummary history={read} edge={derived.edge} address={history.address} symbol={symbol} />
              <ReputationPanel reputation={derived.reputation} badges={derived.badges} />
            </div>
          ) : null
        }
      </ReadingBoundary>
    </section>
  );
}
