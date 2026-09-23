import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "~/theme";

/** web's `.news-live-dot`: a vermilion dot with a ring that breathes out; still under Reduce Motion. */
export function LiveDot({ size = 8 }: { size?: number }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
  }, [reduce, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 1.6 }] }));
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: color.accent }, ring]} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: color.accent }]} />
    </View>
  );
}
