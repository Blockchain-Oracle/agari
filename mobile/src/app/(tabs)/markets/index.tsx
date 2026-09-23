import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLanesState } from "@/features/markets/lanes/useLanes";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { SECTIONS } from "@/lib/copy";
import { Button, haptic, Hero, SectionHeader } from "~/components/kit";
import { TabScreen } from "~/components/shell/TabScreen";
import { LaneBoard } from "~/features/markets/board/LaneBoard";
import { WordBoard } from "~/features/markets/board/WordBoard";
import { NATIVE_MARKETS } from "~/features/markets/copy";
import { SessionChip } from "~/features/markets/parts/SessionChip";
import { FONT, SPACE, useTheme } from "~/theme";

/**
 * The Markets tab (web's /markets: MarketsScreen). §01 the live Windows by lane — 5m, 15m, 1h, Gap, and the 24/7
 * token, pre-IPO and basket lanes — with the ticker picker and every card state (trading, closing, listed pre-open,
 * paused, the next-Window cards while the stock market is shut); §02 the same Windows as plain Yes/No questions, led
 * by the closed strip off-hours. A card opens its Window; a side opens the ticket.
 */
export default function MarketsScreen() {
  const { color } = useTheme();
  const queryClient = useQueryClient();
  const venue = useVenue();
  const nowMs = useChainNowMs();
  const lanes = useLanesState(venue.venueId);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    haptic.select();
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  };
  const failure = lanes.reading && !lanes.reading.ok ? lanes.reading.error : venue.venueFailure;

  return (
    <TabScreen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.accent} colors={[color.accent]} />}
      >
        <Hero kicker={NATIVE_MARKETS.kicker} title={NATIVE_MARKETS.title} lead={NATIVE_MARKETS.lead}>
          <View style={[styles.meta, { borderTopColor: color.hairline }]}>
            <View style={styles.live}>
              <View style={[styles.dot, { backgroundColor: color.profit }]} />
              <Text style={[styles.mono, { color: color.profit }]}>{NATIVE_MARKETS.liveVenue}</Text>
            </View>
            <Text style={[styles.mono, { color: color.inkMuted }]}>{NATIVE_MARKETS.network}</Text>
          </View>
          <Button label={NATIVE_MARKETS.links.senseiBoard} variant="outline" size="sm" icon={{ ios: "sparkles", android: "auto_awesome" }} onPress={() => router.push("/sensei" as never)} />
        </Hero>

        <SectionHeader index={SECTIONS.lanes.index} title={SECTIONS.lanes.title} />
        <SessionChip />
        <LaneBoard state={lanes} nowMs={nowMs} />

        <SectionHeader index={SECTIONS.words.index} title={SECTIONS.words.title} desc={SECTIONS.words.desc} />
        <WordBoard laneSet={lanes.laneSet} failure={failure} ticker={lanes.ticker} nowMs={nowMs} />
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SPACE.gutter, paddingTop: 20, paddingBottom: 130, gap: 16 },
  meta: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6, paddingTop: 12, flexDirection: "row", justifyContent: "space-between" },
  mono: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.8 },
  live: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
