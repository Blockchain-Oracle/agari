import type { Address } from "@agari/core/types";
import { keys, usePositions } from "@agari/markets/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { MoneyUnits } from "@/features/activity/describe";
import { takeItem } from "@/features/activity/items";
import type { ActivityFeed } from "@/features/activity/protocol";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { PROFILE } from "@/features/profile/copy";
import type { TakesFeed } from "@/features/takes/protocol";
import { ErrorState, LoadingState } from "~/components/kit";
import { ActivityList } from "~/features/activity/ActivityList";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { BetRow } from "~/features/portfolio/BetRow";
import { FONT, useTheme } from "~/theme";
import { profileTokens } from "~/theme/web/explore/profile";
import { SECTION_HEAD } from "./ProfileRecord";

/** The takes poll is Masayume's (`useTakes.ts`): 20 s, and a take is at most 5 minutes old when it lands. */
const TAKES_STALE_MS = 20_000;
const TAKES_SHOWN = 10;

async function readTakes(address: Address, signal: AbortSignal): Promise<TakesFeed> {
  const response = await fetch(`/api/takes?authors=${encodeURIComponent(address)}&limit=${TAKES_SHOWN}`, { signal });
  if (!response.ok) throw new Error(`takes ${response.status}`);
  return (await response.json()) as TakesFeed;
}

/**
 * web's ProfileCalls: open calls in the `.bets-plate` (Portfolio's own BetRow over `usePositions`, public index data),
 * then the wallet's recent signed takes as the activity wire.
 */
export function ProfileCalls({ address, units }: { address: Address; units: MoneyUnits }) {
  const { name, color } = useTheme();
  const t = profileTokens(name);
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
  const retry = () => void queryClient.invalidateQueries({ queryKey: keys.positions(address) });

  let calls;
  if (positions === null) calls = <View style={styles.inset}><LoadingState shape="row" /></View>;
  else if (!positions.ok) calls = <View style={styles.inset}><ErrorState diagnosis={positions.error} retry={retry} /></View>;
  else if (positions.value.length === 0) {
    // web's EmptyState inside the plate: its own bordered card, inset 16 20 by `.bets-plate > *`.
    calls = (
      <View style={[styles.empty, { backgroundColor: t.plate, borderColor: t.plateBorder }]}>
        <Text style={[styles.body, { color: color.ink }]}>{PROFILE.calls.none}</Text>
      </View>
    );
  } else {
    calls = (
      <View>
        {positions.value.map((position) => (
          <BetRow key={position.marketId} position={position} symbol={units.symbol} nowMs={nowMs} />
        ))}
      </View>
    );
  }

  return (
    <>
      <View accessibilityLabel={PROFILE.calls.title}>
        <SectionHeader index={PROFILE.calls.number} title={PROFILE.calls.title} desc={PROFILE.calls.desc} style={SECTION_HEAD} />
        <View style={[styles.plate, { backgroundColor: t.plate, borderColor: t.plateBorder }]}>{calls}</View>
      </View>
      <View accessibilityLabel={PROFILE.takes.title}>
        <SectionHeader index={PROFILE.takes.number} title={PROFILE.takes.title} desc={PROFILE.takes.desc} style={SECTION_HEAD} />
        <ActivityList feed={takesFeed} failed={takes.isError} units={units} showWho={false} empty={PROFILE.takes.none} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  plate: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  inset: { paddingVertical: 16, paddingHorizontal: 20 },
  empty: { gap: 12, paddingVertical: 16, paddingHorizontal: 20, borderWidth: 1, borderRadius: 12 },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
});
