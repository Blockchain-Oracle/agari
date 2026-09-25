import { sessionStateWord } from "@agari/core/copy";
import { haltLabel } from "@agari/core/market";
import { marketsProvider } from "@agari/markets";
import { useTick } from "@agari/markets/react";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { MARKETS } from "@/lib/copy";
import { useSessionPhrase } from "@/lib/when";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products/baskets-short";

const PHRASE_TICK_MS = 30_000;

/**
 * web's `features/markets/session/MarketSessionChip.tsx` (`.mks-chip`) on a phone, where the state word and its dot
 * separator are hidden and the dot carries the state: vermilion and pulsing while open, gray-300 lit before and after
 * hours, half-vermilion on a holiday, gray-600 shut. A halt names only its reason. Nothing while the session is unknown.
 */
export function MarketSessionChip() {
  const session = useMarketSession();
  useTick(PHRASE_TICK_MS);
  const phraseOf = useSessionPhrase();
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  if (!session) return null;
  const state = session.status.state;
  const halted = state === "halted" && session.halt !== null;
  const open = state === "regular" || state === "early-close";
  const dot = open || halted ? color.accent : state === "pre" || state === "post" ? t.sessionDotLit : state === "holiday" ? t.sessionDotHoliday : color.inkDisabled;
  const word = sessionStateWord(session.status);
  const phrase = phraseOf(session.status, Math.floor(marketsProvider.nowMs() / 1000));
  const tail = phrase.startsWith(`${word} · `) ? phrase.slice(word.length + 3) : session.label;
  const label = halted && session.halt ? haltLabel(session.halt.reason) : null;
  return (
    <View
      style={styles.chip}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label ? MARKETS.session.aria(MARKETS.session.halted, label) : MARKETS.session.aria(word, tail)}
    >
      <Dot ink={dot} pulse={open} />
      <Text style={[styles.text, { color: label ? color.accent : color.inkMuted }]} numberOfLines={1}>
        {label ?? tail}
      </Text>
    </View>
  );
}

/** `.mks-chip-dot`, with part-06's `pulseDot` (opacity 1 → 0.55 → 1 and a 6 px vermilion ring fading) while open. */
function Dot({ ink, pulse }: { ink: string; pulse: boolean }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const beat = useSharedValue(0);
  useEffect(() => {
    beat.value = pulse && !reduce ? withRepeat(withTiming(1, { duration: 1600, easing: Easing.bezier(0.22, 1, 0.36, 1) }), -1, false) : 0;
  }, [pulse, reduce, beat]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: beat.value < 0.7 ? 1 - (beat.value / 0.7) * 0.45 : 0.55 + ((beat.value - 0.7) / 0.3) * 0.45 }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: beat.value < 0.7 ? 0.45 * (1 - beat.value / 0.7) : 0,
    transform: [{ scale: 1 + Math.min(beat.value / 0.7, 1) * 2.4 }],
  }));
  return (
    <View style={styles.dotBox}>
      {pulse ? <Animated.View style={[styles.dot, styles.ring, { backgroundColor: color.accent }, ringStyle]} /> : null}
      <Animated.View style={[styles.dot, { backgroundColor: ink }, dotStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  dotBox: { width: 5, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  ring: { position: "absolute" },
  text: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
});
