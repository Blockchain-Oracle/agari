import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { haptic } from "~/components/kit";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT, useTheme } from "~/theme";
import { playOnboarding } from "./onboarding-sound";

const MARK = 88;
const HOLD_MS = 2100;

/**
 * The first second of the app: the Window Cut mark springs up, AGARI tracks in from wide letter-spacing, then 上がり
 * lands like a hanko stamp with the brand chime and a heavy tap. A tap anywhere moves on; Reduce Motion skips it.
 */
export function BrandIntro({ onDone }: { onDone: () => void }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const mark = useSharedValue(0);
  const word = useSharedValue(0);
  const stampIn = useSharedValue(0);
  const stampScale = useSharedValue(2.4);
  const out = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      onDone();
      return;
    }
    mark.value = withSpring(1, { damping: 14, stiffness: 140 });
    word.value = withDelay(260, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
    // The hanko: in from 2.4× and slammed flat, a little overshoot, then still.
    stampIn.value = withDelay(820, withTiming(1, { duration: 90 }));
    stampScale.value = withDelay(820, withSpring(1, { damping: 11, stiffness: 320, mass: 0.7 }));
    const land = setTimeout(() => {
      playOnboarding("intro");
      haptic.heavy();
    }, 900);
    out.value = withDelay(HOLD_MS, withTiming(0, { duration: 320 }, (done) => done && runOnJS(onDone)()));
    return () => clearTimeout(land);
  }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const markStyle = useAnimatedStyle(() => ({ opacity: mark.value, transform: [{ scale: 0.6 + 0.4 * mark.value }, { translateY: 18 * (1 - mark.value) }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, letterSpacing: 18 - 12 * word.value }));
  const stampStyle = useAnimatedStyle(() => ({ opacity: stampIn.value, transform: [{ scale: stampScale.value }, { rotate: "-8deg" }] }));
  const fade = useAnimatedStyle(() => ({ opacity: out.value }));

  if (reduce) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: color.ground }, fade]}>
      <Pressable style={styles.center} onPress={onDone} accessibilityRole="button" accessibilityLabel="Agari 上がり. Tap to continue">
        <Animated.View style={markStyle}>
          <AgariMark width={MARK} height={MARK} />
        </Animated.View>
        <View style={styles.words}>
          <Animated.Text style={[styles.name, { color: color.ink }, wordStyle]}>AGARI</Animated.Text>
          <Animated.View style={[styles.stamp, { borderColor: color.accent }, stampStyle]}>
            <Text style={[styles.jp, { color: color.accent }]}>上がり</Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { zIndex: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 28 },
  words: { alignItems: "center", gap: 18 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 36 },
  stamp: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  jp: { fontFamily: FONT.stamp, fontSize: 26, lineHeight: 34, letterSpacing: 2 },
});
