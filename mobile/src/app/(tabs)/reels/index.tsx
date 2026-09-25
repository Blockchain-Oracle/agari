import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type ViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isClosing, reelPhase } from "@/features/markets/reels/useReelRounds";
import type { ReelItem } from "@/features/takes/weave";
import { REELS } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { TabScreen } from "~/components/shell/TabScreen";
import { DeskReelCard, HoldingReelCard } from "~/features/markets/reels/FeedCards";
import { ReelCard } from "~/features/markets/reels/ReelCard";
import { SwipeHint, TakeButton } from "~/features/markets/reels/ReelChrome";
import { ReelHolding, ReelSlot } from "~/features/markets/reels/ReelFrame";
import { TakeReelCard } from "~/features/markets/reels/TakeReelCard";
import { useReelFeed } from "~/features/markets/reels/useReelFeed";
import { TakeComposerSheet } from "~/features/takes/TakeComposerSheet";

/** A real move, not the first stray pixel of momentum — the reference's own correction. */
const SCROLLED_PX = 60;
/** A take's age prints at a minute's grain, so its card re-renders once a minute. */
const MINUTE_MS = 60_000;
/** web's dock floats 0.8 rem off the viewport's foot; the reel's clearances are measured from there. */
const WEB_DOCK_BOTTOM = 12.8;
const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

type Row = { kind: "closed"; line: string } | { kind: "empty"; line: string } | ReelItem;

/**
 * web's `/reels` (`ReelsScreen`): a full-height vertical snap feed between the header and the viewport's foot — live
 * Windows woven with community takes, "you hold this" cards and your desk's latest decision; off-hours the closed card
 * leads it. The floating Take slab opens the composer; the swipe hint stays until the reel has moved. Only the card on
 * screen and its neighbours read live.
 */
export default function ReelsScreen() {
  const { reel, closedLine, waiting, venueId, nowMs, laneSet, configured } = useReelFeed();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { m } = useLocalSearchParams<{ m?: string }>();
  const box = useRef<View>(null);
  const list = useRef<FlatList<Row>>(null);
  const [frame, setFrame] = useState({ height: 0, top: 0 });
  const [active, setActive] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const restored = useRef(false);

  const hasReel = reel.length > 0;
  const holding = waiting ? REELS.reading : venueId === null ? REELS.noVenue : !hasReel ? (closedLine ?? REELS.betweenRounds) : null;
  const leading = holding === null && closedLine !== null ? 1 : 0;
  const rows = useMemo<Row[]>(
    () => (holding !== null ? [{ kind: "empty", line: holding }] : [...(closedLine !== null ? [{ kind: "closed" as const, line: closedLine }] : []), ...reel]),
    [holding, closedLine, reel],
  );
  const minuteMs = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
  const dockLift = Math.max(WEB_DOCK_BOTTOM, insets.bottom - 8) - WEB_DOCK_BOTTOM;

  const onLayout = (event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    box.current?.measureInWindow((_x, y) => setFrame({ height, top: y }));
  };
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<Row>[] }) => {
    const first = viewableItems[0]?.index;
    if (first !== undefined && first !== null) {
      setActive(first);
      haptic.select();
    }
  }).current;

  // web's useReelPosition: a `?m=<marketId>` link lands on that Window's card, once, the moment it exists.
  useEffect(() => {
    if (restored.current || !m || frame.height === 0) return;
    const index = rows.findIndex((row) => row.kind === "market" && row.market.marketId === m);
    if (index < 0) return;
    restored.current = true;
    list.current?.scrollToIndex({ index, animated: false });
  }, [m, rows, frame.height]);

  const renderItem = useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      const near = Math.abs(index - active) <= 1;
      return (
        <ReelSlot height={frame.height} bottomClear={92 + dockLift}>
          {item.kind === "closed" || item.kind === "empty" ? (
            <ReelHolding>{item.line}</ReelHolding>
          ) : item.kind === "market" ? (
            <ReelCard market={item.market} near={near} closing={isClosing(reelPhase(item.market, nowMs))} />
          ) : item.kind === "take" ? (
            <TakeReelCard take={item.take} nowMs={minuteMs} />
          ) : item.kind === "holding" ? (
            <HoldingReelCard pick={item.pick} />
          ) : (
            <DeskReelCard decision={item.decision} nowSec={Math.floor(minuteMs / 1000)} />
          )}
        </ReelSlot>
      );
    },
    // The clock is read inside the cards; `closing` flips once, so a tick every second does not rebuild the pager.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, frame.height, dockLift, minuteMs, Math.floor(nowMs / 5_000)],
  );

  return (
    <TabScreen>
      <View ref={box} style={styles.fill} onLayout={onLayout}>
        {frame.height > 0 ? (
          <FlatList
            ref={list}
            data={rows}
            keyExtractor={rowKey}
            renderItem={renderItem}
            pagingEnabled
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: frame.height, offset: frame.height * index, index })}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={VIEWABILITY}
            onScroll={(event) => {
              if (!scrolled && event.nativeEvent.contentOffset.y > SCROLLED_PX) setScrolled(true);
            }}
            scrollEventThrottle={100}
            windowSize={3}
            initialNumToRender={2}
          />
        ) : null}
        {hasReel && holding === null && frame.height > 0 ? (
          <>
            <TakeButton centerY={windowHeight / 2 - frame.top} onPress={() => setComposerOpen(true)} />
            <SwipeHint label={leading > 0 ? REELS.swipeTakes : REELS.swipeHint} bottom={86 + dockLift} hidden={scrolled} />
          </>
        ) : null}
      </View>
      <TakeComposerSheet visible={composerOpen} laneSet={laneSet} nowMs={nowMs} configured={configured} onClose={() => setComposerOpen(false)} />
    </TabScreen>
  );
}

function rowKey(row: Row, index: number): string {
  if (row.kind === "market") return row.market.marketId;
  if (row.kind === "take") return `take-${row.take.id}`;
  if (row.kind === "holding") return `hold-${row.pick.underlying}-${index}`;
  if (row.kind === "desk") return `desk-${row.decision.record.seq}`;
  return row.kind;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
