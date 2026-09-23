import type { EventMarket } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { useCallback, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View, type LayoutChangeEvent, type ViewToken } from "react-native";
import { useLanesState } from "@/features/markets/lanes/useLanes";
import { isClosing, reelPhase, useReelRounds } from "@/features/markets/reels/useReelRounds";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { REELS } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { useSessionPhrase } from "@/lib/when";
import { haptic, LoadingState } from "~/components/kit";
import { TabScreen } from "~/components/shell/TabScreen";
import { ReelCard } from "~/features/markets/reels/ReelCard";
import { ReelRail } from "~/features/markets/reels/ReelRail";
import { ClosedStrip } from "~/features/markets/board/WordBoard";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/**
 * The reel (web's /reels, ReelsScreen): a full-screen vertical pager of live Windows, one per asset and lane, soonest
 * bell first — the question, the live line against its strike, and Up/Down straight into the ticket. Only the card on
 * screen and its neighbours read live. Off-hours the closed line leads, and the 24/7 Windows still roll beneath it.
 */
export default function ReelsScreen() {
  const { color } = useTheme();
  const venue = useVenue();
  const nowMs = useChainNowMs();
  const lanes = useLanesState(venue.venueId);
  const session = useMarketSession();
  const phrase = useSessionPhrase();
  const rounds = useReelRounds(lanes.laneSet, nowMs);
  const [height, setHeight] = useState(0);
  const [active, setActive] = useState(0);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<EventMarket>[] }) => {
    const first = viewableItems[0]?.index;
    if (first !== undefined && first !== null) {
      setActive(first);
      haptic.select();
    }
  }).current;
  const onLayout = (event: LayoutChangeEvent) => setHeight(Math.round(event.nativeEvent.layout.height));
  const renderItem = useCallback(
    ({ item, index }: { item: EventMarket; index: number }) => <ReelCard market={item} near={Math.abs(index - active) <= 1} closing={isClosing(reelPhase(item, nowMs))} height={height} />,
    // The clock is read inside the card; `closing` flips once, so a tick every second does not rebuild the pager.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, height, Math.floor(nowMs / 5_000)],
  );

  const waiting = lanes.reading === null || nowMs === 0;
  const closedLine = session && !session.open ? SESSION_COPY.sessionClosedLine(phrase(session.status, Math.floor((nowMs > 0 ? nowMs : marketsProvider.nowMs()) / 1000))) : null;
  const holding = waiting ? REELS.reading : venue.venueId === null && venue.venueFailure ? REELS.noVenue : rounds.length === 0 ? (closedLine ?? REELS.betweenRounds) : null;

  return (
    <TabScreen>
      {closedLine && rounds.length > 0 ? (
        <View style={styles.strip}>
          <ClosedStrip line={closedLine} />
        </View>
      ) : null}
      <View style={styles.page}>
        <View style={styles.fill} onLayout={onLayout}>
          {holding !== null ? (
            <View style={[styles.holding, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
              <Text style={[TYPE.title, styles.center, { color: color.ink }]}>{holding}</Text>
              {waiting ? <LoadingState shape="chart" /> : null}
            </View>
          ) : height > 0 ? (
            <>
              <FlatList
                data={rounds}
                keyExtractor={(market) => market.marketId}
                renderItem={renderItem}
                pagingEnabled
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
                onViewableItemsChanged={onViewable}
                viewabilityConfig={VIEWABILITY}
                windowSize={3}
                initialNumToRender={2}
              />
              <ReelRail count={rounds.length} active={active} hint={active === 0 ? REELS.swipeHint : null} />
            </>
          ) : null}
        </View>
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingBottom: 86 },
  fill: { flex: 1 },
  strip: { paddingHorizontal: SPACE.gutter, paddingTop: 8 },
  holding: { margin: 12, flex: 1, borderRadius: RADIUS.xl, borderWidth: StyleSheet.hairlineWidth, padding: 24, justifyContent: "center", gap: 18 },
  center: { textAlign: "center" },
});
