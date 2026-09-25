import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useMarqueeItems, type MarqueeItem } from "@/components/shell/useMarqueeItems";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { CHROME, chromeTokens } from "~/theme/chrome";

/** web's .marquee-track: one run of cells scrolls past in 80 s (translateX -50% of the doubled track). */
const RUN_MS = 80_000;

/** web's Marquee (the same cells from useMarqueeItems), scrolled on the UI thread; still under Reduce Motion. */
export function Marquee() {
  const items = useMarqueeItems();
  const { name } = useTheme();
  const t = chromeTokens(name);
  const reduceMotion = useReducedMotion();
  const [runWidth, setRunWidth] = useState(0);
  const offset = useSharedValue(0);

  useEffect(() => {
    if (runWidth === 0 || reduceMotion) return;
    offset.value = 0;
    offset.value = withRepeat(withTiming(-runWidth, { duration: RUN_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(offset);
  }, [runWidth, reduceMotion, offset]);

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const onRun = (e: LayoutChangeEvent) => setRunWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <View style={[styles.strip, { backgroundColor: t.marqueeBg, borderBottomColor: t.marqueeBorder }]} accessibilityRole="text" accessibilityLabel={items.map((i) => `${i.label} ${i.value}`).join(", ")}>
      <Animated.View style={[styles.track, track]}>
        <View style={styles.run} onLayout={onRun}>
          {items.map((item, i) => <Cell key={`a${i}`} item={item} />)}
        </View>
        <View style={styles.run}>{items.map((item, i) => <Cell key={`b${i}`} item={item} />)}</View>
      </Animated.View>
    </View>
  );
}

function Cell({ item }: { item: MarqueeItem }) {
  const { name, color } = useTheme();
  const t = chromeTokens(name);
  // web: .up in vermilion, .down in gray-500.
  const dirColor = item.direction === "up" ? color.accent : color.inkMuted;
  return (
    <View style={styles.cell}>
      {item.asset ? <AssetDisc asset={item.asset} size={10} /> : null}
      <Text style={[styles.label, { color: t.marqueeLabel }]}>{item.label}</Text>
      <Text style={[styles.value, { color: t.marqueeValue }]}>{item.value}</Text>
      {item.direction ? <Text style={[styles.value, { color: dirColor }]}>{item.tag ?? (item.direction === "up" ? "↑" : "↓")}</Text> : null}
      {item.note ? <Text style={[styles.label, { color: t.marqueeLabel }]}>{item.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { height: CHROME.marquee, overflow: "hidden", justifyContent: "center", borderBottomWidth: 1 },
  track: { flexDirection: "row" },
  run: { flexDirection: "row", gap: 28, paddingLeft: 28 },
  cell: { flexDirection: "row", alignItems: "center", gap: 7 },
  // web at phone width: 7 px mono, 400, letter-spacing 0.07.
  label: { fontFamily: FONT.dataRegular, fontSize: 7, lineHeight: 11.2, letterSpacing: 0.07 },
  value: { fontFamily: FONT.dataRegular, fontSize: 7, lineHeight: 11.2, letterSpacing: 0.07 },
});
