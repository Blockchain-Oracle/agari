import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import { accentIndex } from "@/features/strategies/names";
import { useStrat } from "./ui";

/** The reference's persona: `notionists` on its paper tile, radius 12 — drawn once per seed. */
const DRAWN_CAP = 512;
const drawn = new Map<string, string>();

function persona(seed: string, paper: string): string {
  const cached = drawn.get(seed);
  if (cached !== undefined) return cached;
  const svg = createAvatar(notionists, { seed, backgroundColor: [paper.replace("#", "").toLowerCase()], radius: 12 }).toString();
  if (drawn.size >= DRAWN_CAP) drawn.clear();
  drawn.set(seed, svg);
  return svg;
}

/** strategies.css `.strat-sigil--small / --row / --card`. */
const SIZE = { small: 36, row: 44, card: 56 } as const;
const IDLE_MS = 1800;

/**
 * web's features/strategies/AgentPortrait.tsx: the same DiceBear face on its paper tile inside part-17's 13 px
 * rounded sigil with the hairline ring, breathing on its own beat (strat-idle: a 3 % bob with a hair of tilt, 3.6 s,
 * phased by the seed so a grid never moves in unison). Still under reduced motion.
 */
export function AgentPortrait({ seed, name, size = "card" }: { seed: string; name: string; size?: keyof typeof SIZE }) {
  const { t } = useStrat();
  const px = SIZE[size];
  const reduce = useReducedMotion();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    const delay = ((accentIndex(seed) * 0.45) % 3.6) * 1000;
    phase.value = withDelay(delay, withRepeat(withTiming(1, { duration: IDLE_MS, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [reduce, seed, phase]);
  const idle = useAnimatedStyle(() => ({
    transform: [{ translateY: px * 0.42 }, { translateY: -0.03 * px * phase.value }, { rotate: `${-2 * phase.value}deg` }, { translateY: -px * 0.42 }],
  }));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name}, agent portrait`}
      style={[styles.sigil, { width: px, height: px, backgroundColor: t.paper }]}
    >
      <Animated.View style={idle}>
        <SvgXml xml={persona(seed, t.paper)} width={px} height={px} />
      </Animated.View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring, { borderColor: t.sigilRing }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  sigil: { borderRadius: 13, overflow: "hidden", flexShrink: 0 },
  ring: { borderRadius: 13, borderWidth: 1 },
});
