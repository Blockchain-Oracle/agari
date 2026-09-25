import { isOk } from "@agari/core/schemas";
import { useLanes } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import { LEADERBOARD_KEY, useLeaderboard } from "@/features/leaderboard/useLeaderboard";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { TRACTION_KEY, useTraction } from "@/features/stats/useTraction";
import { diagnosisCopy } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { CONTAINER_GUTTER, ExplorePage } from "~/features/explore/ExplorePage";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { banzukeRows, podiumOrder, spanOf } from "./board";
import { BoardActivity } from "./BoardActivity";
import { BoardHero } from "./BoardHero";
import { BoardEmpty, BoardReading } from "./BoardState";
import { Banzuke } from "./Banzuke";
import { Podium } from "./Podium";
import { YouBar } from "./YouBar";

/** web's `--claim-pill-offset` above the safe area: the dock's clearance plus 8. */
const YOU_OFFSET = 72;
/** The bar's own height on a phone, so the page can scroll its last row clear of it. */
const YOU_HEIGHT = 140;

/**
 * `/leaderboard` — web's LeaderboardScreen + LeaderboardBoard on a phone: the hero and filter bar, the freshness line,
 * then every state (reading, failed, empty), 01 the podium, 02 the field, 03 live activity, and the sticky vermilion
 * bar with your rank above the dock whenever a wallet is connected.
 */
export function LeaderboardScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { address } = useWalletSession();
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const nowMs = useChainNowMs();
  const [board, setBoard] = useState<BoardQuery>({ period: "session", ticker: null });
  const reading = useLeaderboard(board);
  const activity = useTraction();
  const client = useQueryClient();
  const retry = () => void client.invalidateQueries({ queryKey: LEADERBOARD_KEY });
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: LEADERBOARD_KEY }), client.invalidateQueries({ queryKey: TRACTION_KEY })]);

  const data = reading && isOk(reading) ? reading.value : null;
  const span = spanOf(data, board, nowMs);
  const podium = useMemo(() => (data ? podiumOrder(data.rankings) : []), [data]);
  const field = useMemo(() => (data ? banzukeRows(data.rankings) : []), [data]);
  const nextExpirySec = useMemo(() => {
    if (!lanes || !isOk(lanes)) return null;
    const live = lanes.value.lanes.flatMap((lane) => lane.markets.map((market) => market.expirySec)).filter((expiry) => expiry * 1000 > nowMs);
    return live.length ? Math.min(...live) : null;
  }, [lanes, nowMs]);
  const showYou = address !== null && data !== null;

  return (
    <View style={styles.fill}>
      <ExplorePage title={LEADERBOARD.title} onRefresh={refresh} style={showYou ? { paddingBottom: CHROME.dockClearance + YOU_HEIGHT + 24 } : undefined}>
        <BoardHero data={data} board={board} onBoard={setBoard} span={span} nextExpirySec={nextExpirySec} nowMs={nowMs} />
        {reading?.ok ? (
          <Text style={[styles.freshness, { color: color.inkMuted }]} accessibilityLiveRegion="polite">
            {LEADERBOARD.updated(reading.asOfMs)}
            {reading.stale ? ` · ${reading.staleReason === "refresh-failed" ? LEADERBOARD.refreshFailed : LEADERBOARD.refreshing}` : ""}
          </Text>
        ) : null}
        {reading === null ? <BoardReading text={LEADERBOARD.loading} /> : null}
        {reading !== null && !isOk(reading) ? (
          <BoardEmpty headline={LEADERBOARD.failed} sub={diagnosisCopy(reading.error.kind).headline} retry={{ label: LEADERBOARD.retry, onPress: retry }} />
        ) : null}
        {data && data.rankings.length === 0 ? <BoardEmpty headline={LEADERBOARD.empty.headline} sub={LEADERBOARD.empty.body} /> : null}
        {data && podium.length > 0 ? (
          <View>
            <SectionHeader index={LEADERBOARD.podium.number} title={LEADERBOARD.podium.title} desc={LEADERBOARD.podium.desc(span)} style={styles.head} />
            <Podium spots={podium} decimals={data.meta.decimals} symbol={data.meta.symbol} />
          </View>
        ) : null}
        {data && field.length > 0 ? (
          <View>
            <SectionHeader index={LEADERBOARD.field.number} title={LEADERBOARD.field.title} desc={LEADERBOARD.field.desc} eyebrow={LEADERBOARD.field.meta(span)} style={styles.head} />
            <Banzuke rows={field} decimals={data.meta.decimals} span={span} />
          </View>
        ) : null}
        <BoardActivity reading={activity} nowMs={nowMs} />
      </ExplorePage>
      {showYou && data ? (
        <View style={[styles.you, { bottom: insets.bottom + YOU_OFFSET }]} pointerEvents="box-none">
          <YouBar address={address} data={data} span={span} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  freshness: { marginTop: 16, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  head: { marginTop: 48, marginBottom: 24 },
  you: { position: "absolute", left: CONTAINER_GUTTER, right: CONTAINER_GUTTER },
});
