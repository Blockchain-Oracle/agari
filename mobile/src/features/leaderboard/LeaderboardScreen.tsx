import { isOk } from "@agari/core/schemas";
import { useLanes } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import { LEADERBOARD_KEY, useLeaderboard } from "@/features/leaderboard/useLeaderboard";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { TRACTION_KEY, useTraction } from "@/features/stats/useTraction";
import { diagnosisCopy } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, EmptyState, haptic, LoadingState, Screen, SectionHeader } from "~/components/kit";
import { SPACE, TYPE, useTheme } from "~/theme";
import { fieldRows, podiumOrder, spanOf } from "./board";
import { BoardActivity } from "./BoardActivity";
import { BoardFilters } from "./BoardFilters";
import { BoardHero } from "./BoardHero";
import { FieldList } from "./FieldList";
import { Podium } from "./Podium";
import { YouBar } from "./YouBar";

/**
 * `/leaderboard` — web's LeaderboardScreen + LeaderboardBoard: the hero with the live next-close seal, the period and
 * ticker filters, the podium, the field of ranks four to fifty, live activity, and the sticky bar with your own rank.
 */
export function LeaderboardScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { address } = useWalletSession();
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const nowMs = useChainNowMs();
  const [board, setBoard] = useState<BoardQuery>({ period: "session", ticker: null });
  const [refreshing, setRefreshing] = useState(false);
  const reading = useLeaderboard(board);
  const activity = useTraction();
  const client = useQueryClient();
  const refetch = () => client.invalidateQueries({ queryKey: LEADERBOARD_KEY });
  const refetchAll = () => Promise.all([refetch(), client.invalidateQueries({ queryKey: TRACTION_KEY })]);

  const data = reading && isOk(reading) ? reading.value : null;
  const span = spanOf(data, board, nowMs);
  const podium = useMemo(() => (data ? podiumOrder(data.rankings) : []), [data]);
  const field = useMemo(() => (data ? fieldRows(data.rankings) : []), [data]);
  const nextExpirySec = useMemo(() => {
    if (!lanes || !isOk(lanes)) return null;
    const live = lanes.value.lanes.flatMap((lane) => lane.markets.map((market) => market.expirySec)).filter((expiry) => expiry * 1000 > nowMs);
    return live.length ? Math.min(...live) : null;
  }, [lanes, nowMs]);

  const refresh = async () => {
    setRefreshing(true);
    haptic.select();
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  const words = LEADERBOARD.hero;
  const meta = data ? words.closedCalls(data.meta.closedCalls, span, data.meta.complete, data.meta.ticker ?? null) : words.counting;
  const showYou = address !== null && data !== null;

  return (
    <Screen title={LEADERBOARD.title} scroll={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.body, { paddingBottom: showYou ? 170 + insets.bottom : 60 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.accent} colors={[color.accent]} />}
      >
        <BoardHero data={data} board={board} span={span} nextExpirySec={nextExpirySec} nowMs={nowMs} />
        <BoardFilters board={board} onBoard={setBoard} meta={meta} />

        {reading?.ok ? (
          <Text style={[TYPE.caption, { color: reading.stale ? color.warning : color.inkMuted }]} accessibilityRole="text">
            {LEADERBOARD.updated(reading.asOfMs)}
            {reading.stale ? ` · ${reading.staleReason === "refresh-failed" ? LEADERBOARD.refreshFailed : LEADERBOARD.refreshing}` : ""}
          </Text>
        ) : null}

        {reading === null ? <LoadingState shape="list" label={LEADERBOARD.loading} /> : null}
        {reading !== null && !isOk(reading) ? (
          <View style={[styles.failed, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityRole="alert">
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{LEADERBOARD.failed}</Text>
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{diagnosisCopy(reading.error.kind).headline}</Text>
            <Button label={LEADERBOARD.retry} size="sm" block={false} onPress={() => void refetch()} />
          </View>
        ) : null}
        {data && data.rankings.length === 0 ? <EmptyState why={LEADERBOARD.empty.headline} detail={LEADERBOARD.empty.body} /> : null}
        {data && podium.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader index={LEADERBOARD.podium.number} title={LEADERBOARD.podium.title} desc={LEADERBOARD.podium.desc(span)} />
            <Podium spots={podium} decimals={data.meta.decimals} symbol={data.meta.symbol} />
          </View>
        ) : null}
        {data && field.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader index={LEADERBOARD.field.number} title={LEADERBOARD.field.title} desc={LEADERBOARD.field.desc} aside={LEADERBOARD.field.meta(span)} />
            <FieldList rows={field} decimals={data.meta.decimals} span={span} address={address} />
          </View>
        ) : null}
        <BoardActivity reading={activity} nowMs={nowMs} />
      </ScrollView>
      {showYou && data ? (
        <View style={[styles.dock, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
          <YouBar address={address} data={data} span={span} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 12, gap: 18 },
  section: { gap: 12 },
  failed: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10, alignItems: "flex-start" },
  dock: { position: "absolute", left: SPACE.gutter, right: SPACE.gutter, bottom: 0 },
});
