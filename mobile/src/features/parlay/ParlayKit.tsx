import { SETTLING } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import { formatClock } from "@agari/core/units";
import { Loader2 } from "lucide-react-native";
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Reanimated, { Keyframe } from "react-native-reanimated";
import { useTheme } from "~/theme";

const PLACEHOLDER = "–:––";

/**
 * web's `components/data/Countdown.tsx` as an inline span: the Window's time left from the parent's chain-corrected
 * clock, "Settling…" once it has closed, the accent ink in its urgent last stretch; otherwise it inherits the ink.
 */
export function Countdown({ expirySec, intervalSec, nowMs }: { expirySec: number; intervalSec: number; nowMs: number }) {
  const { color } = useTheme();
  const state = nowMs > 0 ? countdown(nowMs, expirySec, intervalSec) : null;
  return (
    <Text accessibilityRole="timer" style={[styles.numbers, state?.urgent ? { color: color.accent } : null]}>
      {state ? (state.settling ? SETTLING : formatClock(state.remainingSec)) : PLACEHOLDER}
    </Text>
  );
}

/** lucide's Loader2 under Tailwind's `animate-spin` (one turn a second, linear). */
export function Spinner({ size, color }: { size: number; color: string }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}

/** parlay-page.css `pl-rise`: opacity and 8 px of travel over 220 ms (the reference's framer enter). */
const RISE = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 8 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }] },
}).duration(220);

/** parlay-page.css `pl-drop`: opacity and 4 px of fall over 160 ms. */
const DROP = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -4 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }] },
}).duration(160);

export function Rise({ children, style, drop = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; drop?: boolean }) {
  return (
    <Reanimated.View entering={drop ? DROP : RISE} style={style}>
      {children}
    </Reanimated.View>
  );
}

/** A flex row that keeps its children centred on one line (the lucide glyph beside its label). */
export function IconRow({ gap, children, style }: { gap: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  numbers: { fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
});
