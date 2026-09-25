import { Stack } from "expo-router";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { CHROME } from "~/theme/chrome";
import { useStrat } from "./ui";

interface StickyContext {
  scrollY: SharedValue<number>;
  content: React.RefObject<View | null>;
}

const Ctx = createContext<StickyContext | null>(null);

/**
 * `main.page-shell` for /strategies: the page ground, the dock's 112 px floor, pull to refresh, and the one thing a
 * plain ScrollView lacks here — web's `position: sticky` archive tab bar, which stays at the top of the scroll while
 * the cards pass under it.
 */
export function StickyPage({ title, onRefresh, children }: { title: string; onRefresh?: () => Promise<unknown> | void; children: ReactNode }) {
  const { color } = useStrat();
  const scrollY = useSharedValue(0);
  const content = useRef<View>(null);
  const refreshControl = usePullRefresh(onRefresh);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return (
    <Ctx.Provider value={{ scrollY, content }}>
      <Stack.Screen options={{ title, headerShown: false }} />
      <Animated.ScrollView
        style={[styles.fill, { backgroundColor: color.ground }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
      >
        <View ref={content} collapsable={false} style={styles.content}>
          {children}
        </View>
      </Animated.ScrollView>
    </Ctx.Provider>
  );
}

/** A block that sticks to the top of the page's scroll once it reaches it, as web's `sticky top-…` does. */
export function Sticky({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ctx = useContext(Ctx);
  const self = useRef<View>(null);
  const top = useSharedValue(Number.POSITIVE_INFINITY);
  const measure = () => {
    const host = ctx?.content.current;
    if (!host || !self.current) return;
    self.current.measureLayout(host, (_x, y) => {
      top.value = y;
    });
  };
  const lift = useAnimatedStyle(() => {
    const y = ctx ? ctx.scrollY.value - top.value : 0;
    return { transform: [{ translateY: y > 0 ? y : 0 }] };
  });
  return (
    <Animated.View ref={self} collapsable={false} onLayout={measure} style={[styles.sticky, style, lift]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: CHROME.dockClearance },
  sticky: { zIndex: 20, elevation: 20 },
});
