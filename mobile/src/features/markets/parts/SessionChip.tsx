import { sessionStateWord } from "@agari/core/copy";
import { haltLabel, isTickerSymbol } from "@agari/core/market";
import { marketsProvider } from "@agari/markets";
import { useTick } from "@agari/markets/react";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useMarketSession, type MarketSession } from "@/features/markets/session/useMarketSession";
import { MARKETS } from "@/lib/copy";
import { useSessionPhrase } from "@/lib/when";
import { FONT } from "~/theme";
import type { MarketsTokens } from "~/theme/web/markets";
import { useMk } from "../hero/mk";

const PHRASE_TICK_MS = 30_000;
/** `pulseDot` (yosuku part-08, the definition that wins): opacity 0.3 ↔ 1 over 1.6 s. */
const PULSE_MS = 800;

/** A halt shows in regular hours on a stock lane, and at any hour on a token lane (web's `haltShown`). */
function haltShown(session: MarketSession, asset: string | undefined): boolean {
  if (!session.halt) return false;
  return session.status.state === "halted" || (asset !== undefined && !isTickerSymbol(asset));
}

function dotColor(state: string, mk: MarketsTokens): string {
  if (state === "regular" || state === "early-close" || state === "halted") return mk.vermilion;
  if (state === "pre" || state === "post") return mk.gray300;
  if (state === "holiday") return mk.chipHoliday;
  return mk.gray600;
}

/**
 * web's MarketSessionChip as a phone draws it (market-session.css ≤ 639 px): the 5 px dot carries the state and the
 * phrase's tail follows it ("● opens 14:30 (09:30 ET), in 6h 56m"), mono 10 px caps in gray-500; open, the dot is
 * vermilion and pulses. A halt is its reason alone, in vermilion. Renders nothing while the session is unknown.
 */
export function SessionChip({ asset }: { asset?: string }) {
  const session = useMarketSession(asset);
  useTick(PHRASE_TICK_MS);
  const phraseOf = useSessionPhrase();
  const mk = useMk();
  if (!session) return null;

  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  const halted = session.halt !== null && haltShown(session, asset);
  const state = halted ? "halted" : session.status.state;
  const word = halted && session.halt ? haltLabel(session.halt.reason) : sessionStateWord(session.status);
  const phrase = phraseOf(session.status, nowSec);
  const tail = halted ? "" : phrase.startsWith(`${word} · `) ? phrase.slice(word.length + 3) : session.label;
  return (
    <View style={styles.chip} accessibilityRole="text" accessibilityLabel={MARKETS.session.aria(halted ? MARKETS.session.halted : word, halted ? word : tail)}>
      <Dot color={dotColor(state, mk)} pulse={state === "regular" || state === "early-close"} />
      <Text style={[styles.text, { color: halted ? mk.vermilion : mk.gray500 }]} numberOfLines={1} ellipsizeMode="clip">
        {halted ? word : tail}
      </Text>
    </View>
  );
}

function Dot({ color, pulse }: { color: string; pulse: boolean }) {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = pulse && !reduce ? withRepeat(withTiming(0.3, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }), -1, true) : 1;
  }, [pulse, reduce, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  text: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase", flexShrink: 1 },
});
