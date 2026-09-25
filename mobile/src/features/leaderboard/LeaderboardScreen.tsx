import { isOk } from "@agari/core/schemas";
import { useLanes } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
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
import { haptic, Screen } from "~/components/kit";
import { CONTAINER_GUTTER } from "~/features/explore/ExplorePage";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { fieldRows, podiumOrder, spanOf } from "./board";
import { BoardActivity } from "./BoardActivity";
import { BoardControls } from "./BoardControls";
import { BoardHero } from "./BoardHero";
import { BoardEmpty, BoardSkeleton, BoardSparse } from "./BoardState";
import { Podium } from "./Podium";
import { RankList } from "./RankList";
import { BOARD_PHONE } from "./words";
import { YOU_BAR_H, YouBar } from "./YouBar";

/** The floating dock's own height (BottomDock: 5 + 6.75 + icon and label + 6.75 + 5, its 1 pt ring) and a gap. */
const DOCK_H = 60;
const GAP = 8;

/**
 * `/leaderboard` — mobile-first (the owner's pass over web's LeaderboardBoard, in its visual language): a compact
 * header with one row of stat tiles, the period segment and ticker chips pinned under it while the page scrolls, the
 * top three on 2-1-3 pedestals, the field as dense rows that open each trader's record, a few rows of live activity,
 * and a slim your-rank bar docked above the floating dock. Pull to refresh re-reads the board and the tape.
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
  const retry = () => void client.invalidateQueries({ queryKey: LEADERBOARD_KEY });
  const refresh = async () => {
    setRefreshing(true);
    haptic.select();
    try {
      await Promise.all([client.invalidateQueries({ queryKey: LEADERBOARD_KEY }), client.invalidateQueries({ queryKey: TRACTION_KEY })]);
    } finally {
      setRefreshing(false);
    }
  };

  const data = reading && isOk(reading) ? reading.value : null;
  const span = spanOf(data, board, nowMs);
  const podium = useMemo(() => (data ? podiumOrder(data.rankings) : []), [data]);
  const field = useMemo(() => (data ? fieldRows(data.rankings) : []), [data]);
  const nextExpirySec = useMemo(() => {
    if (!lanes || !isOk(lanes)) return null;
    const live = lanes.value.lanes.flatMap((lane) => lane.markets.map((market) => market.expirySec)).filter((expiry) => expiry * 1000 > nowMs);
    return live.length ? Math.min(...live) : null;
  }, [lanes, nowMs]);

  const words = LEADERBOARD.hero;
  const meta = data ? words.closedCalls(data.meta.closedCalls, span, data.meta.complete, data.meta.ticker ?? null) : words.counting;
  const showYou = address !== null && data !== null;
  const dockTop = Math.max(12.8, insets.bottom - 8) + DOCK_H;
  const count = data?.rankings.length ?? 0;
  // Only the sections on screen are numbered, in order: 01 podium, 02 the field when it shows, then live activity.
  const showPodium = data !== null && podium.length > 0;
  const showField = data !== null && field.length > 0;
  const shown = [showPodium && "podium", showField && "field", "activity"].filter(Boolean) as string[];
  const numberOf = (section: string) => String(shown.indexOf(section) + 1).padStart(2, "0");
  const numbers = { podium: numberOf("podium"), field: numberOf("field"), activity: numberOf("activity") };

  return (
    <Screen title={LEADERBOARD.title} scroll={false}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.body, { paddingBottom: CHROME.dockClearance + (showYou ? YOU_BAR_H + GAP * 2 : 0) }]}
        stickyHeaderIndices={[1]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.accent} colors={[color.accent]} />}
      >
        <BoardHero data={data} board={board} span={span} nextExpirySec={nextExpirySec} nowMs={nowMs} />
        <BoardControls board={board} onBoard={setBoard} meta={meta} />
        <View>
          {reading?.ok ? (
            <Text style={[styles.freshness, { color: color.inkDisabled }]} numberOfLines={1} accessibilityLiveRegion="polite">
              {BOARD_PHONE.updated(reading.asOfMs)}
              {reading.stale ? ` · ${BOARD_PHONE.retrying}` : ""}
            </Text>
          ) : null}
          {reading === null ? <BoardSkeleton label={LEADERBOARD.loading} /> : null}
          {reading !== null && !isOk(reading) ? (
            <BoardEmpty headline={LEADERBOARD.failed} sub={diagnosisCopy(reading.error.kind).headline} action={{ label: LEADERBOARD.retry, onPress: retry }} />
          ) : null}
          {data && count === 0 ? (
            <BoardEmpty headline={LEADERBOARD.empty.headline} sub={LEADERBOARD.empty.body} action={{ label: BOARD_PHONE.placeCall, onPress: () => router.navigate("/markets") }} />
          ) : null}
          {data && showPodium ? (
            <View>
              <SectionHeader index={numbers.podium} title={LEADERBOARD.podium.title} style={styles.head} />
              <Podium spots={podium} decimals={data.meta.decimals} symbol={data.meta.symbol} />
            </View>
          ) : null}
          {data && count > 0 && count <= 3 ? <BoardSparse headline={BOARD_PHONE.sparse(count, span)} /> : null}
          {data && showField ? (
            <View>
              <SectionHeader index={numbers.field} title={BOARD_PHONE.field.title} desc={BOARD_PHONE.field.desc} eyebrow={LEADERBOARD.field.meta(span)} style={styles.head} />
              <RankList rows={field} decimals={data.meta.decimals} address={address} />
            </View>
          ) : null}
          <BoardActivity reading={activity} nowMs={nowMs} index={numbers.activity} />
        </View>
      </ScrollView>
      {showYou && data ? (
        <View style={[styles.you, { bottom: dockTop + GAP }]} pointerEvents="box-none">
          <YouBar address={address} data={data} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: CONTAINER_GUTTER },
  freshness: { marginTop: 10, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 14, letterSpacing: 0.6 },
  head: { marginTop: 24, marginBottom: 16 },
  you: { position: "absolute", left: CONTAINER_GUTTER, right: CONTAINER_GUTTER },
});
