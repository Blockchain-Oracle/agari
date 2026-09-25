import { countdown } from "@agari/core/lifecycle";
import type { LaneSet } from "@agari/core/types";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { SENSEI_TEASERS, SENSEI_UI } from "@/features/sensei/copy";
import { useSenseiSnapshot } from "@/features/sensei/useSenseiSnapshot";
import { haptic } from "~/components/kit";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT } from "~/theme";
import { useMk } from "../hero/mk";

/** The ring's geometry, from the reference's `R = 30` on a 72-unit viewBox, drawn at 46 px. */
const R = 30;
const TAU = 2 * Math.PI * R;
const AVATAR = 46;
/** Teaser cadence (reference L159–176): three pops, then it rests. */
const TEASER_FIRST_MS = 3_500;
const TEASER_HOLD_MS = 4_800;
const TEASER_GAP_MS = 4_500;
const TEASER_POPS = 3;
/** web's dock sits 90 px off the viewport floor (≤ 768 px), the floating nav 12.8 px: the app keeps that gap to its dock. */
const WEB_WRAP_BOTTOM = 90;
const WEB_NAV_BOTTOM = 12.8;

function useTeaser(): number {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    if (reduced) return;
    let alive = true;
    let pops = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = (delay: number) => {
      timers.push(
        setTimeout(() => {
          if (!alive) return;
          setIndex(pops % SENSEI_TEASERS.length);
          timers.push(
            setTimeout(() => {
              if (!alive) return;
              setIndex(-1);
              pops += 1;
              if (pops < TEASER_POPS) cycle(TEASER_GAP_MS);
            }, TEASER_HOLD_MS),
          );
        }, delay),
      );
    };
    cycle(TEASER_FIRST_MS);
    return () => {
      alive = false;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [reduced]);
  return index;
}

/**
 * web's SenseiDock over /markets: the Agari mark in a ring that drains to the nearest close (vermilion, pulsing faster
 * when urgent), and the "Up or down?" teaser that pops above it three times, then rests. Either opens Sensei.
 */
export function SenseiDock({ laneSet, nowMs }: { laneSet: LaneSet | null; nowMs: number }) {
  const mk = useMk();
  const insets = useSafeAreaInsets();
  const reading = useSenseiSnapshot(laneSet, nowMs);
  const teaser = useTeaser();
  const nearest = reading.nearest;
  const clock = nearest && nowMs > 0 ? countdown(nowMs, nearest.expirySec, nearest.intervalSec) : null;
  const urgent = clock?.urgent ?? false;
  const fraction = nearest && clock ? Math.max(0, Math.min(1, clock.remainingSec / Math.max(1, nearest.intervalSec))) : 0;
  const open = () => {
    haptic.tap();
    router.push("/sensei");
  };
  // The app's dock floats max(12.8, inset − 8) off the floor (BottomDock); keep web's 77 px between the two.
  const bottom = WEB_WRAP_BOTTOM - WEB_NAV_BOTTOM + Math.max(WEB_NAV_BOTTOM, insets.bottom - 8);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      {teaser >= 0 ? (
        <Animated.View key={teaser} entering={ZoomIn.springify().damping(11).stiffness(220)} exiting={FadeOut.duration(160)} style={styles.teaserWrap}>
          <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={SENSEI_UI.ask(SENSEI_TEASERS[teaser]!)} style={[styles.teaser, { backgroundColor: mk.vermilion, shadowColor: mk.teaserShadow }]}>
            <Text style={[styles.teaserText, { color: mk.teaserInk }]}>{SENSEI_TEASERS[teaser]}</Text>
            <View style={[styles.tail, { backgroundColor: mk.vermilion }]} />
          </Pressable>
        </Animated.View>
      ) : null}
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={SENSEI_UI.open} style={({ pressed }) => [styles.dock, { backgroundColor: mk.dockBg, shadowColor: mk.dockShadow }, pressed && styles.pressed]}>
        <View pointerEvents="none" style={[styles.ring, { borderColor: mk.dockRing }]} />
        <View style={styles.avatar}>
          <Svg width={AVATAR} height={AVATAR} viewBox="0 0 72 72" style={styles.svg}>
            <Circle cx={36} cy={36} r={R} fill="none" stroke={mk.dockTrack} strokeWidth={4} />
            <Circle cx={36} cy={36} r={R} fill="none" stroke={mk.vermilion} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${TAU} ${TAU}`} strokeDashoffset={TAU * (1 - fraction)} />
          </Svg>
          <AgariMark width={24} height={24} figure={mk.dockGlyph} />
          <Pulse urgent={urgent} color={mk.vermilion} />
        </View>
      </Pressable>
    </View>
  );
}

/** `.sensei-dock-pulse`: a hairline ring that swells from 0.95 to 1.2 and fades, every 3.4 s (1.4 s when urgent). */
function Pulse({ urgent, color }: { urgent: boolean; color: string }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    const cycle = urgent ? 1_400 : 3_400;
    t.value = 0;
    t.value = withRepeat(withSequence(withTiming(1, { duration: cycle * 0.7, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: cycle * 0.3 }), withTiming(0, { duration: 0 })), -1);
  }, [urgent, reduce, t]);
  const style = useAnimatedStyle(() => ({ opacity: 0.3 * (1 - t.value), transform: [{ scale: 0.95 + 0.25 * t.value }] }));
  if (reduce) return null;
  return <Animated.View pointerEvents="none" style={[styles.pulse, { borderColor: color }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16, zIndex: 900, alignItems: "flex-end", gap: 10 },
  teaserWrap: { marginRight: 5 },
  teaser: { borderTopLeftRadius: 15, borderTopRightRadius: 15, borderBottomRightRadius: 4, borderBottomLeftRadius: 15, paddingVertical: 9, paddingHorizontal: 14, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 14 },
  teaserText: { fontFamily: FONT.headingSemi, fontSize: 13, lineHeight: 16 },
  tail: { position: "absolute", right: 15, bottom: -4, width: 9, height: 9, borderBottomRightRadius: 3, transform: [{ rotate: "45deg" }] },
  dock: { padding: 7, borderRadius: 999, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.45, shadowRadius: 16 },
  ring: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, borderWidth: 1 },
  pressed: { transform: [{ scale: 0.97 }] },
  avatar: { width: AVATAR, height: AVATAR, alignItems: "center", justifyContent: "center" },
  svg: { position: "absolute", top: 0, left: 0, transform: [{ rotate: "-90deg" }] },
  pulse: { position: "absolute", top: -1, left: -1, right: -1, bottom: -1, borderRadius: 999, borderWidth: 1 },
});
