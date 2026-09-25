import { ChevronUp, Feather } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { REELS } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { useReelTokens } from "./tokens";

/**
 * reel-chrome.css `.reel-take`: the social entry point, fixed on the right rail at the viewport's mid-height so it
 * never covers a card's action row — a vermilion slab with the feather and "Take". `centerY` is where the viewport's
 * middle falls inside the reel.
 */
export function TakeButton({ centerY, onPress }: { centerY: number; onPress: () => void }) {
  const t = useReelTokens();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={REELS.postTake}
      style={({ pressed }) => [styles.take, { top: centerY - 37.5, backgroundColor: t.vermilion, boxShadow: t.takeShadow }, pressed && styles.pressed]}
    >
      <Feather size={24} color={t.onVermilion} strokeWidth={2} />
      <Text style={[styles.takeText, { color: t.onVermilion }]}>{REELS.take}</Text>
    </Pressable>
  );
}

/**
 * reel-chrome.css `.reel-hint`: the bouncing chevron (the page's ink) over the vermilion pill, 86 px above the
 * viewport's foot, fading out once the reel has moved 60 px — nothing else says this is a snap scroll.
 */
export function SwipeHint({ label, bottom, hidden }: { label: string; bottom: number; hidden: boolean }) {
  const t = useReelTokens();
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const lift = useSharedValue(-5);
  const shown = useSharedValue(1);
  useEffect(() => {
    if (reduce) {
      lift.value = 0;
      return;
    }
    lift.value = withRepeat(
      withSequence(withTiming(0, { duration: 500, easing: Easing.bezier(0.8, 0, 1, 1) }), withTiming(-5, { duration: 500, easing: Easing.bezier(0, 0, 0.2, 1) })),
      -1,
    );
    return () => cancelAnimation(lift);
  }, [reduce, lift]);
  useEffect(() => {
    shown.value = withTiming(hidden ? 0 : 1, { duration: reduce ? 0 : 500 });
  }, [hidden, reduce, shown]);
  const arrow = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.hint, { bottom }, fade]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={arrow}>
        <ChevronUp size={20} strokeWidth={3} color={color.ink} />
      </Animated.View>
      <Animated.View style={[styles.pill, { backgroundColor: t.vermilion, boxShadow: t.hintShadow }]}>
        <Text style={[styles.pillText, { color: t.onVermilion }]}>{label}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  take: { position: "absolute", right: 16, zIndex: 40, alignItems: "center", gap: 6, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20 },
  pressed: { transform: [{ scale: 0.97 }] },
  takeText: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 13 },
  hint: { position: "absolute", left: 0, right: 0, zIndex: 40, alignItems: "center", gap: 6 },
  pill: { borderRadius: 9999, paddingVertical: 6, paddingHorizontal: 14 },
  pillText: { fontFamily: FONT.heading, fontSize: 12, lineHeight: 12 },
});
