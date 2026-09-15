"use client";

import type { Address } from "@agari/core/types";
import { keys, usePositions } from "@agari/markets/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { SectionHeader } from "@/components/chrome";
import { ReadingBoundary } from "@/components/states";
import { ActivityList } from "@/features/activity/ActivityList";
import { takeItem } from "@/features/activity/items";
import type { ActivityFeed } from "@/features/activity/protocol";
import type { MoneyUnits } from "@/features/activity/describe";
import { BetRow } from "@/features/markets/portfolio/BetRow";
import { useChainNowMs } from "@/features/markets/useChainNow";
import type { TakesFeed } from "@/features/takes/protocol";
import { PROFILE } from "./copy";

/** The takes poll is Masayume's (`useTakes.ts`): 20 s, and a take is at most 5 minutes old when it lands. */
const TAKES_STALE_MS = 20_000;
const TAKES_SHOWN = 10;

async function readTakes(address: Address, signal: AbortSignal): Promise<TakesFeed> {
  const response = await fetch(`/api/takes?authors=${encodeURIComponent(address)}&limit=${TAKES_SHOWN}`, { signal });
  if (!response.ok) throw new Error(`takes ${response.status}`);
  return (await response.json()) as TakesFeed;
}

/** Open calls (Portfolio's bet rows over `usePositions`, public index data) and the wallet's recent signed takes. */
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
      <section className="prf-section" aria-label={PROFILE.calls.title}>
        <SectionHeader index={PROFILE.calls.number} title={PROFILE.calls.title} desc={PROFILE.calls.desc} className="lb-section-head" />
        <div className="bets-plate">
          <ReadingBoundary
            reading={positions}
            shape="row"
            retry={() => void queryClient.invalidateQueries({ queryKey: keys.positions(address) })}
            isEmpty={(value) => value.length === 0}
            empty={{ why: PROFILE.calls.none }}
          >
            {(value) => (
              <ul className="bets-list">
                {value.map((position) => (
                  <BetRow key={position.marketId} position={position} symbol={units.symbol} nowMs={nowMs} />
                ))}
              </ul>
            )}
          </ReadingBoundary>
        </div>
      </section>

      <section className="prf-section" aria-label={PROFILE.takes.title}>
        <SectionHeader index={PROFILE.takes.number} title={PROFILE.takes.title} desc={PROFILE.takes.desc} className="lb-section-head" />
        <ActivityList feed={takesFeed} failed={takes.isError} units={units} showWho={false} empty={PROFILE.takes.none} />
      </section>
    </>
  );
}
