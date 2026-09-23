import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useMarqueeItems, type MarqueeItem } from "@/components/shell/useMarqueeItems";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";

/** Points per second: web's strip crosses a phone in about eight seconds. */
const SPEED = 40;

/** web's Marquee (the same cells from useMarqueeItems), scrolled on the UI thread; still under Reduce Motion. */
export function Marquee() {
  const items = useMarqueeItems();
  const { color } = useTheme();
  const reduceMotion = useReducedMotion();
  const [runWidth, setRunWidth] = useState(0);
  const offset = useSharedValue(0);

  useEffect(() => {
    if (runWidth === 0 || reduceMotion) return;
    offset.value = 0;
    offset.value = withRepeat(withTiming(-runWidth, { duration: (runWidth / SPEED) * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(offset);
  }, [runWidth, reduceMotion, offset]);

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const onRun = (e: LayoutChangeEvent) => setRunWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <View style={[styles.strip, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityRole="text" accessibilityLabel={items.map((i) => `${i.label} ${i.value}`).join(", ")}>
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
  const { color } = useTheme();
  const dirColor = item.direction === "up" ? color.profit : item.direction === "down" ? color.loss : color.inkMuted;
  return (
    <View style={styles.cell}>
      {item.asset ? <AssetDisc asset={item.asset} size={12} /> : null}
      <Text style={[styles.label, { color: color.inkMuted }]}>{item.label}</Text>
      <Text style={[styles.value, { color: color.ink }]}>{item.value}</Text>
      {item.direction ? <Text style={[styles.value, { color: dirColor }]}>{item.tag ?? (item.direction === "up" ? "↑" : "↓")}</Text> : null}
      {item.note ? <Text style={[styles.label, { color: color.inkMuted }]}>{item.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { height: 24, overflow: "hidden", justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  track: { flexDirection: "row" },
  run: { flexDirection: "row", gap: 28, paddingLeft: 28 },
  cell: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.4 },
  value: { fontFamily: FONT.dataStrong, fontSize: 10 },
});
