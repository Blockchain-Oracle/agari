import { useCallback, useRef, useState, type ReactNode } from "react";
import { FlatList, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "expo-router/react-navigation";
import { Button, haptic } from "~/components/kit";
import { FONT, RADIUS, SPACE, useTheme } from "~/theme";

export interface Page {
  id: string;
  /** The page's section word, shown in the folio line ("[ 03 / 15 ] · THE PROBLEM"). */
  section: string;
  render: () => ReactNode;
}

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Page>);

// 21st: cnippet-dev/v-carousel-8 — "Step n of N" over a progress bar, one page per step, Back / Next underneath.
/**
 * A native paged deck: swipe between pages (each scrolls on its own when it is taller than the phone), the folio and a
 * progress bar that follows the finger, and Back / Next at the thumb. A page change ticks a selection haptic.
 */
export function Pager({ pages, finish }: { pages: readonly Page[]; finish?: { label: string; onPress: () => void } }) {
  const { color } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Screen's iOS header is translucent glass over the content; Android's app bar is solid and takes its own room.
  const headerHeight = useHeaderHeight();
  const top = Platform.OS === "ios" ? headerHeight : 0;
  const list = useRef<FlatList<Page>>(null);
  const [index, setIndex] = useState(0);
  const x = useSharedValue(0);
  const total = pages.length;

  const onScroll = useAnimatedScrollHandler((event) => {
    x.value = event.contentOffset.x;
  });
  const fill = useAnimatedStyle(() => ({ width: `${Math.min(100, ((x.value / Math.max(1, width) + 1) / total) * 100)}%` }));

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
      if (next !== index) {
        haptic.select();
        setIndex(next);
      }
    },
    [index, width],
  );

  const go = (to: number) => {
    const target = Math.max(0, Math.min(total - 1, to));
    list.current?.scrollToIndex({ index: target, animated: true });
    haptic.select();
    setIndex(target);
  };

  const page = pages[index];
  const folio = `[ ${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")} ] · ${page?.section ?? ""}`;
  const last = index === total - 1;

  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <View style={[styles.head, { paddingTop: top + 8 }]}>
        <Text style={[styles.folio, { color: color.inkMuted }]} accessibilityLiveRegion="polite">
          {folio}
        </Text>
        <View style={[styles.track, { backgroundColor: color.surface2 }]}>
          <Animated.View style={[styles.bar, { backgroundColor: color.accent }, fill]} />
        </View>
      </View>

      <AnimatedFlatList
        ref={list}
        data={pages as Page[]}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        initialNumToRender={2}
        windowSize={3}
        renderItem={({ item }) => (
          <ScrollView style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
            {item.render()}
          </ScrollView>
        )}
      />

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button label="Back" variant="outline" onPress={() => go(index - 1)} disabled={index === 0} style={styles.footButton} />
        {last && finish ? (
          <Button label={finish.label} onPress={finish.onPress} style={styles.footButton} />
        ) : (
          <Button label="Next" onPress={() => go(index + 1)} disabled={last} style={styles.footButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { paddingHorizontal: SPACE.gutter, gap: 8 },
  folio: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase" },
  track: { height: 3, borderRadius: RADIUS.full, overflow: "hidden" },
  bar: { height: 3, borderRadius: RADIUS.full },
  page: { padding: SPACE.gutter, paddingTop: 20, paddingBottom: 32, gap: 16 },
  foot: { flexDirection: "row", gap: 10, paddingHorizontal: SPACE.gutter, paddingTop: 10 },
  footButton: { flex: 1 },
});
