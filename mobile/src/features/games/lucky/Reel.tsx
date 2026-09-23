import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LUCKY } from "@/features/games/lucky/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { reelLock } from "./reel-sfx";

/**
 * One reel of web's `LuckyReels.tsx` as a real strip — 21st: hyperiux/rolling-text (a column of duplicates that
 * scrolls and eases out onto the final value), ported to Reanimated on the UI thread. While the round trips run the
 * strip loops at web's step rate (one value per 60 ms); once the deal is in hand the reel decelerates onto its value
 * so that it lands exactly at its own stop time, then thunks.
 */
const CELL = 88;
const STEP_MS = 60;
const DECEL_MS = 420;
const FADE = 16;

interface ReelProps<T> {
  index: number;
  label: string;
  pool: readonly T[];
  target: T | null;
  cycling: boolean;
  landing: boolean;
  reduced: boolean;
  haptics: boolean;
  /** When this reel lands, counted from the deal's arrival. */
  stopMs: number;
  last: boolean;
  render: (value: T) => ReactNode;
  onStop: (index: number) => void;
}

// 21st: hyperiux/rolling-text
export function Reel<T>({ index, label, pool, target, cycling, landing, reduced, haptics, stopMs, last, render, onStop }: ReelProps<T>) {
  const { color } = useTheme();
  const n = Math.max(1, pool.length);
  const loop = n * CELL;
  // Enough copies that a landing a full loop further on never runs off the strip, even for the two-value side reel.
  const copies = Math.max(4, Math.ceil(24 / n));
  const y = useSharedValue(0);
  const [locked, setLocked] = useState(target !== null);
  const [blank, setBlank] = useState(target === null);
  const stopRef = useRef(onStop);
  stopRef.current = onStop;
  const targetIndex = target === null ? -1 : pool.indexOf(target);

  // At rest: the landed value, or the blank face.
  useEffect(() => {
    if (cycling || landing) return;
    setLocked(target !== null);
    setBlank(target === null);
    if (targetIndex >= 0) y.value = -(loop + targetIndex * CELL);
  }, [cycling, landing, target, targetIndex, loop, y]);

  // Rolling: loop the strip from the tap until this reel's own landing takes over.
  const rolling = cycling || landing;
  useEffect(() => {
    if (!rolling) return;
    setLocked(false);
    if (reduced) {
      setBlank(true);
      return;
    }
    setBlank(false);
    y.value = 0;
    y.value = withRepeat(withTiming(-loop, { duration: n * STEP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(y);
  }, [rolling, reduced, loop, n, y]);

  // Landing: decelerate onto the value so the reel stops at its own time.
  useEffect(() => {
    if (!landing || targetIndex < 0) return;
    const land = () => {
      setLocked(true);
      reelLock(last, haptics);
      stopRef.current(index);
    };
    if (reduced) {
      setBlank(false);
      y.value = -(loop + targetIndex * CELL);
      land();
      return;
    }
    const timer = setTimeout(() => {
      cancelAnimation(y);
      // Where the loop has got to, folded into the first copy of the pool.
      const current = -((((-y.value) % loop) + loop) % loop);
      y.value = current;
      let end = -(loop + targetIndex * CELL);
      if (current - end < CELL * 2) end -= loop;
      y.value = withTiming(end, { duration: DECEL_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(land)();
      });
    }, Math.max(0, stopMs - DECEL_MS));
    return () => clearTimeout(timer);
    // `haptics` and `last` are read when the reel lands; a change mid-spin should not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing, targetIndex, reduced, loop, stopMs, index, y]);

  const strip = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const cells = Array.from({ length: copies * n }, (_, i) => pool[i % n] as T);

  return (
    <View style={styles.reel}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <View
        style={[styles.face, { backgroundColor: color.surface2, borderColor: locked ? color.accent : color.hairline }]}
        accessible
        accessibilityLabel={`${label}: ${locked && target !== null ? String(target) : LUCKY.reels.blank}`}
      >
        {blank ? (
          <View style={styles.cell}>
            <SymbolView name={{ ios: "questionmark.circle", android: "help" }} size={30} tintColor={color.inkMuted} />
            <Text style={[styles.value, { color: color.inkMuted }]}>{LUCKY.reels.blank}</Text>
          </View>
        ) : (
          <Animated.View style={strip}>
            {cells.map((value, i) => (
              <View key={i} style={styles.cell}>
                {render(value)}
              </View>
            ))}
          </Animated.View>
        )}
        <Fade ink={color.surface2} edge="top" />
        <Fade ink={color.surface2} edge="bottom" />
      </View>
    </View>
  );
}

/** The strip's soft edge: the face's own ground fading over the passing values. */
function Fade({ ink, edge }: { ink: string; edge: "top" | "bottom" }) {
  const id = `reel-fade-${edge}`;
  return (
    <Svg pointerEvents="none" style={[styles.fade, edge === "top" ? styles.fadeTop : styles.fadeBottom]} width="100%" height={FADE}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ink} stopOpacity={edge === "top" ? 1 : 0} />
          <Stop offset="1" stopColor={ink} stopOpacity={edge === "top" ? 0 : 1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height={FADE} fill={`url(#${id})`} />
    </Svg>
  );
}

/** A reel's face: the stock's disc, the side's arrow or the reach, over its word. */
export function ReelFace({ kind, asset, text, ink }: { kind: "asset" | "up" | "down" | "reach"; asset?: string; text: string; ink: string }) {
  return (
    <>
      {kind === "asset" && asset ? <AssetDisc asset={asset} size={34} /> : null}
      {kind === "up" ? <SymbolView name={{ ios: "arrow.up.right", android: "trending_up" }} size={30} tintColor={ink} /> : null}
      {kind === "down" ? <SymbolView name={{ ios: "arrow.down.right", android: "trending_down" }} size={30} tintColor={ink} /> : null}
      <Text style={[kind === "reach" ? styles.reach : styles.value, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {text}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  reel: { flex: 1, gap: 6 },
  face: { height: CELL, borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden" },
  cell: { height: CELL, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 },
  value: { fontFamily: FONT.dataStrong, fontSize: 15, letterSpacing: 0.4 },
  reach: { fontFamily: FONT.dataStrong, fontSize: 30, lineHeight: 34 },
  fade: { position: "absolute", left: 0, right: 0, height: FADE },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
});
