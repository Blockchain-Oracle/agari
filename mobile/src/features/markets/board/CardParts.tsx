import { LinearGradient } from "expo-linear-gradient";
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { useTheme } from "~/theme";
import { lanesTokens } from "~/theme/web/markets-lanes";
import { card } from "./card-styles";

/** `.mc-head`: the disc, ticker, serif cadence and (a 24/7 Window) its kind chip; the clock at the right. */
export function CardHead({ asset, ticker, cadence, kind, clock, clockTone }: { asset: string; ticker: string; cadence: string; kind?: string | null; clock: ReactNode; clockTone: "live" | "quiet" }) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  const tone = clockTone === "live" ? t.vermilion : t.inkMuted;
  return (
    <View style={[card.head, { borderBottomColor: t.cardRule }]}>
      <View style={card.asset}>
        <AssetDisc asset={asset} size={26} />
        <Text style={[card.ticker, { color: t.ink }]}>{ticker}</Text>
        <Text style={[card.cadence, { color: t.vermilion }]}>{cadence}</Text>
        {kind ? <Text style={[card.kind, { color: t.vermilion, borderColor: t.kindBorder }]}>{kind}</Text> : null}
      </View>
      <View style={card.countdown}>
        <View style={[card.clockDot, { backgroundColor: tone }]} />
        {typeof clock === "string" ? <Text style={[card.countdownText, { color: tone }]}>{clock}</Text> : clock}
      </View>
    </View>
  );
}

/** `.mc-pending-dot`: the vermilion dot with part-06's `pendingPulse` — dimming while a ring spreads 9 px and fades. */
export function PendingDot() {
  const { name } = useTheme();
  const t = lanesTokens(name);
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!reduce) p.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.bezier(0.16, 1, 0.3, 1) }), -1, false);
  }, [reduce, p]);
  const dot = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.7, 1], [1, 0.5, 1]) }));
  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.7, 1], [1, 0, 0]),
    transform: [{ scale: interpolate(p.value, [0, 0.7, 1], [1, 3, 1]) }],
  }));
  return (
    <View style={styles.dotBox}>
      <Animated.View style={[styles.ring, { backgroundColor: t.pendingRing }, ring]} />
      <Animated.View style={[styles.dot, { backgroundColor: t.vermilion }, dot]} />
    </View>
  );
}

/** `.mc-pending`: the dot over the copy, its lead in `strong`. `compact` is next-window.css's tighter block. */
export function Pending({ strong, rest, compact }: { strong: string | null; rest: string | null; compact?: boolean }) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  return (
    <View style={[card.pending, compact && styles.compact]}>
      <PendingDot />
      <Text style={[card.pendingCopy, { color: t.inkMuted }]}>
        {strong ? <Text style={[card.pendingStrong, { color: t.gray200 }]}>{strong}</Text> : null}
        {rest}
      </Text>
    </View>
  );
}

/** `.mc-room`: the quiet full-width strip — the Room on a live card, "Schedule a call" on a listed one. */
export function RoomStrip({ label, hint, onPress, accessibilityLabel }: { label: string; hint: string; onPress: () => void; accessibilityLabel?: string }) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [card.room, { backgroundColor: t.roomBg, borderColor: t.roomBorder }, pressed && card.pressed]}
    >
      <Text style={[card.roomLabel, { color: t.roomInk }]}>{label}</Text>
      <Text style={[card.roomHint, { color: t.roomInk }]}>{hint}</Text>
    </Pressable>
  );
}

/** `.mc-strip .ramp`: "UP", the 72 px bar filled to the UP price (vermilion into white, into sand on cream), the figure. */
export function Ramp({ word, cents, figure }: { word: string; cents: number | null; figure: string }) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  return (
    <View style={card.ramp}>
      <Text style={[card.stripText, { color: t.stripInk }]}>{word}</Text>
      <View style={[card.bar, { backgroundColor: t.rampBar }]}>
        {cents !== null ? <LinearGradient colors={[t.rampFrom, t.rampTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${cents}%` }]} /> : null}
      </View>
      <Text style={[card.pct, { color: t.vermilion }]}>{figure}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dotBox: { width: 9, height: 9, alignItems: "center", justifyContent: "center" },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  ring: { position: "absolute", width: 9, height: 9, borderRadius: 4.5 },
  compact: { minHeight: 0, paddingTop: 16, paddingHorizontal: 22, paddingBottom: 22, gap: 10 },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
});
