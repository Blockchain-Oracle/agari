import { computeBadges, computeTraderEdge, reputationOf, type WalletHistory } from "@agari/core/projection";
import { isOk, type Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { keys, useMakerShares, useMakerVault, usePositions } from "@agari/markets/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import type { MoneyUnits } from "@/features/activity/describe";
import { takeItem } from "@/features/activity/items";
import type { ActivityFeed } from "@/features/activity/protocol";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { PROFILE } from "@/features/profile/copy";
import type { TakesFeed } from "@/features/takes/protocol";
import { EmptyState, ReadingView, SectionHeader } from "~/components/kit";
import { ActivityList } from "~/features/social/ActivityList";
import { LinkButton } from "~/features/ticker-hub/HubParts";
import { OpenCallRow } from "./OpenCallRow";
import { EdgeMetrics, HistorySummary, ReputationPanel } from "./RecordPanels";

/** The takes poll is Masayume's: 20 s (web's ProfileCalls). */
const TAKES_STALE_MS = 20_000;
const TAKES_SHOWN = 10;

interface RecordProps {
  address: Address;
  reading: Reading<WalletHistory> | null;
  retry: () => void;
  symbol: string;
  own: boolean;
}

/**
 * web's `ProfileRecord` (features/profile/ProfileRecord.tsx): the record and the edge excerpt from the one settled-history
 * reading — Portfolio's summary, reputation and badges, and Trader Edge's four metrics, computed as those pages do.
 */
export function ProfileRecord({ address, reading, retry, symbol, own }: RecordProps) {
  const value = reading?.ok ? reading.value : null;
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
      <SectionHeader index={PROFILE.record.number} title={PROFILE.record.title} desc={PROFILE.record.desc} />
      <ReadingView reading={reading} loading="plate" retry={retry}>
        {(history) =>
          derived ? (
            <View style={{ gap: 16 }}>
              <HistorySummary edge={derived.edge} decimals={history.decimals} symbol={symbol} />
              <ReputationPanel reputation={derived.reputation} badges={derived.badges} />
            </View>
          ) : null
        }
      </ReadingView>

      <SectionHeader index={PROFILE.edge.number} title={PROFILE.edge.title} desc={PROFILE.edge.desc} />
      {own ? <LinkButton label={PROFILE.edge.open} onPress={() => router.push("/portfolio/edge" as never)} /> : null}
      {derived && value ? (
        derived.edge.settledRounds > 0 ? (
          <EdgeMetrics report={derived.edge} decimals={value.decimals} symbol={symbol} />
        ) : (
          <EmptyState why={PROFILE.edge.none} />
        )
      ) : null}
    </>
  );
}

async function readTakes(address: Address, signal: AbortSignal): Promise<TakesFeed> {
  const response = await fetch(`/api/takes?authors=${encodeURIComponent(address)}&limit=${TAKES_SHOWN}`, { signal });
  if (!response.ok) throw new Error(`takes ${response.status}`);
  return (await response.json()) as TakesFeed;
}

/** web's `ProfileCalls`: open calls over `usePositions` (public index data), then the wallet's recent signed takes. */
export function ProfileCalls({ address, units }: { address: Address; units: MoneyUnits }) {
  const nowMs = useChainNowMs();
  const positions = usePositions(address);
  const queryClient = useQueryClient();
  const takes = useQuery({
    queryKey: ["agari", "takes", "authors", address],
    queryFn: ({ signal }) => readTakes(address, signal),
    staleTime: TAKES_STALE_MS,
  });
  const takesFeed = useMemo<ActivityFeed | null>(
    () => (takes.data ? { configured: takes.data.configured, items: takes.data.takes.map(takeItem), takes: takes.data.takes } : null),
    [takes.data],
  );

  return (
    <>
      <SectionHeader index={PROFILE.calls.number} title={PROFILE.calls.title} desc={PROFILE.calls.desc} />
      <ReadingView reading={positions} retry={() => void queryClient.invalidateQueries({ queryKey: keys.positions(address) })}>
        {(value) =>
          value.length === 0 ? (
            <EmptyState why={PROFILE.calls.none} />
          ) : (
            <View>
              {value.map((position) => (
                <OpenCallRow key={position.marketId} position={position} symbol={units.symbol} nowMs={nowMs} />
              ))}
            </View>
          )
        }
      </ReadingView>

      <SectionHeader index={PROFILE.takes.number} title={PROFILE.takes.title} desc={PROFILE.takes.desc} />
      <ActivityList feed={takesFeed} failed={takes.isError} units={units} showWho={false} empty={PROFILE.takes.none} />
    </>
  );
}
