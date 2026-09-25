import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "~/theme";
import { statsTokens } from "~/theme/web/explore/stats";

/**
 * part-04's `.hero-left .eyebrow .live-dot`: a 6 px vermilion dot on web's `pulseDot` (1.6 s) — it dims to 55 % while a
 * ring spreads 6 px out and fades. Still under Reduce Motion.
 */
export function PulseDot() {
  const { name, color } = useTheme();
  const t = statsTokens(name);
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!reduce) p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.bezier(0.16, 1, 0.3, 1) }), -1, false);
  }, [reduce, p]);
  const dot = useAnimatedStyle(() => ({ opacity: p.value < 0.7 ? 1 - (0.45 * p.value) / 0.7 : 0.55 + (0.45 * (p.value - 0.7)) / 0.3 }));
  const ring = useAnimatedStyle(() => ({ opacity: p.value < 0.7 ? 1 - p.value / 0.7 : 0, transform: [{ scale: 1 + Math.min(p.value / 0.7, 1) * 2 }] }));
  return (
    <View style={styles.box} accessible={false}>
      <Animated.View style={[styles.fill, { backgroundColor: t.dotRing }, ring]} />
      <Animated.View style={[styles.fill, { backgroundColor: color.accent }, dot]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 6, height: 6 },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 3 },
});
