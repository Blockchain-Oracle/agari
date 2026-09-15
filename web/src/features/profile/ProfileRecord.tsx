"use client";

import { computeBadges, computeTraderEdge, reputationOf, type WalletHistory } from "@agari/core/projection";
import { isOk, type Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { useMakerShares, useMakerVault } from "@agari/markets/react";
import Link from "next/link";
import { useMemo } from "react";
import { SectionHeader } from "@/components/chrome";
import { ReadingBoundary } from "@/components/states";
import { EdgeMetrics } from "@/features/edge/EdgeMetrics";
import { EDGE_PATH } from "@/features/markets/history/TraderEdgeLink";
import { HistorySummary } from "@/features/markets/history/HistorySummary";
import { ReputationPanel } from "@/features/markets/history/ReputationPanel";
import { PROFILE } from "./copy";

interface ProfileRecordProps {
  address: Address;
  reading: Reading<WalletHistory> | null;
  retry: () => void;
  symbol: string;
  /** The viewer is this wallet: the edge excerpt then links to their full Trader Edge report. */
  own: boolean;
}

/**
 * The record and the edge excerpt, from the one settled-history reading (`useWalletHistory`, public index data) —
 * Portfolio's own summary strip, reputation and badges (`RecordSection`), and Trader Edge's four metrics, computed
 * exactly as those pages compute them, for whichever wallet the profile names.
 */
export function ProfileRecord({ address, reading, retry, symbol, own }: ProfileRecordProps) {
  const value = reading?.ok ? reading.value : null;
  // The LP badge is the maker vault's shares, as on Portfolio: null where no vault is deployed.
  const vault = useMakerVault();
  const shares = useMakerShares(address);
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
    <>
      <section className="prf-section" aria-label={PROFILE.record.title}>
        <SectionHeader index={PROFILE.record.number} title={PROFILE.record.title} desc={PROFILE.record.desc} className="lb-section-head" />
        <ReadingBoundary reading={reading} shape="plate" retry={retry}>
          {(history) =>
            derived ? (
              <div className="flex flex-col gap-6">
                <HistorySummary history={history} edge={derived.edge} address={address} symbol={symbol} />
                <ReputationPanel reputation={derived.reputation} badges={derived.badges} />
              </div>
            ) : null
          }
        </ReadingBoundary>
      </section>

      <section className="prf-section" aria-label={PROFILE.edge.title}>
        <SectionHeader
          index={PROFILE.edge.number}
          title={PROFILE.edge.title}
          desc={PROFILE.edge.desc}
          className="lb-section-head"
          aside={
            own ? (
              <Link href={EDGE_PATH} className="prf-edge-link" data-cursor="hover">
                {PROFILE.edge.open}
              </Link>
            ) : undefined
          }
        />
        {derived && value ? (
          derived.edge.settledRounds > 0 ? (
            <div className="prf-edge">
              <EdgeMetrics report={derived.edge} decimals={value.decimals} symbol={symbol} />
            </div>
          ) : (
            <p className="news-quiet prf-quiet">{PROFILE.edge.none}</p>
          )
        ) : null}
      </section>
    </>
  );
}
