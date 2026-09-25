import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "~/theme";

/** news.css `.news-live-dot`: a 6 px vermilion dot with a 12 px glow, breathing between full and half opacity; still under Reduce Motion. */
export function LiveDot() {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(0.5, { duration: 1000 }), -1, true);
  }, [reduce, pulse]);
  const fade = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color.accent, shadowColor: color.accent }, fade]} accessible={false} />;
}

const styles = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
});
