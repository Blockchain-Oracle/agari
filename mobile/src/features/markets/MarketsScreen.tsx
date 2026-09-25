import type { EventMarket } from "@agari/core/types";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLanesState } from "@/features/markets/lanes/useLanes";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { SECTIONS } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { LiveHedgeCard } from "~/features/hedge/LiveHedgeCard";
import { MarketRoomSheet } from "~/features/room/MarketRoomSheet";
import { useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { LaneBoard } from "./board/LaneBoard";
import { roomCallLabel } from "./board/MarketCard";
import { WordBoard } from "./board/WordBoard";
import { MarketsHero } from "./hero/MarketsHero";
import { useHeroSelection } from "./hero/useHeroSelection";
import { SessionChip } from "./parts/SessionChip";
import { SenseiDock } from "./sensei-dock/SenseiDock";
import { LiveVerdict } from "./verdict/LiveVerdict";

/**
 * web's MarketsScreen at phone width — the market you are betting on is the page. The hero carries the question, the
 * chart and the call together; below it, the cover banner when this wallet holds a stock token, the hero Window's
 * verdict once it has one, §01 the lanes that change the hero, §02 the same Windows in plain words. The Sensei dock
 * rides above the page and the Room opens over it. `/markets/<id>` is this page with that Window in the hero, as on web.
 */
export function MarketsScreen() {
  const { color } = useTheme();
  const queryClient = useQueryClient();
  const venue = useVenue();
  const nowMs = useChainNowMs();
  const lanes = useLanesState(venue.venueId);
  const { selection, select } = useHeroSelection(lanes.laneSet, lanes.activeLane, lanes.ticker, nowMs);
  // Held at the page, as web holds it: a cadence switch can never leave it open on a Window the page no longer shows.
  const [roomMarket, setRoomMarket] = useState<EventMarket | null>(null);
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
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.accent} colors={[color.accent]} />}
      >
        <MarketsHero selection={selection} lanes={lanes} onSelect={select} onOpenRoom={() => setRoomMarket(selection.market)} />
        <View style={styles.container}>
          <LiveHedgeCard laneSet={lanes.laneSet} nowMs={nowMs} onSelect={select} />
          {selection.marketId ? <LiveVerdict marketId={selection.marketId} /> : null}
          <View style={styles.section} accessibilityLabel={SECTIONS.lanes.title}>
            <SectionHeader index={SECTIONS.lanes.index} title={SECTIONS.lanes.title} aside={<SessionChip />} />
            <LaneBoard state={lanes} boot={venue.boot} venueId={venue.venueId} nowMs={nowMs} selectedMarketId={selection.marketId} onSelect={select} onOpenRoom={setRoomMarket} />
          </View>
          <View style={styles.section} accessibilityLabel={SECTIONS.words.title}>
            <SectionHeader index={SECTIONS.words.index} title={SECTIONS.words.title} desc={SECTIONS.words.desc} />
            <WordBoard laneSet={lanes.laneSet} failure={failure} ticker={lanes.ticker} nowMs={nowMs} />
          </View>
        </View>
      </ScrollView>
      <SenseiDock laneSet={lanes.laneSet} nowMs={nowMs} />
      {roomMarket ? (
        <MarketRoomSheet
          visible
          marketId={roomMarket.marketId}
          callLabel={roomCallLabel(roomMarket)}
          asset={roomMarket.asset}
          onClose={() => setRoomMarket(null)}
          // What unlocks the Room is a position, so "place a bet" selects this Window rather than sending the reader to find it.
          onBet={() => {
            const id = roomMarket.marketId;
            setRoomMarket(null);
            select(id);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // `main.page-shell`'s 112 px floor for the floating dock.
  page: { paddingBottom: CHROME.dockClearance },
  container: { paddingHorizontal: 18 },
  // `.markets-section`: 32 px of top padding, a 16 px column.
  section: { paddingTop: 32, gap: 16 },
});
