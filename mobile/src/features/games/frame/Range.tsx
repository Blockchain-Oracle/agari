import { useEffect, useRef } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useGamesTokens } from "./tokens";

const STEP = 0.05;
const THUMB = 16;
const snap = (v: number) => Math.min(1, Math.max(0, Math.round(v / STEP) * STEP));

/**
 * games.css `.gm-range`: the native 0–1 range in 0.05 steps, full width, in the brand accent — a 16 px tall
 * control with the filled track vermilion and a round vermilion thumb. `onRelease` fires where web's
 * pointerup does.
 */
export function Range({ value, onChange, onRelease, label }: { value: number; onChange: (v: number) => void; onRelease?: (v: number) => void; label: string }) {
  const { t, color } = useGamesTokens();
  const width = useSharedValue(0);
  const level = useSharedValue(value);
  const last = useRef(value);
  useEffect(() => {
    if (value === last.current) return;
    last.current = value;
    level.value = value;
  }, [value, level]);

  const set = (next: number) => {
    const stepped = snap(next);
    if (stepped !== last.current) {
      last.current = stepped;
      onChange(stepped);
    }
  };
  const release = (next: number) => onRelease?.(snap(next));
  const pan = Gesture.Pan()
    .minDistance(0)
    .hitSlop({ top: 12, bottom: 12 })
    .onBegin((e) => {
      if (width.value <= 0) return;
      level.value = Math.min(1, Math.max(0, e.x / width.value));
      runOnJS(set)(level.value);
    })
    .onUpdate((e) => {
      if (width.value <= 0) return;
      level.value = Math.min(1, Math.max(0, e.x / width.value));
      runOnJS(set)(level.value);
    })
    .onFinalize(() => {
      runOnJS(release)(level.value);
    });
  const fill = useAnimatedStyle(() => ({ width: level.value * Math.max(0, width.value - THUMB) + THUMB / 2 }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: level.value * Math.max(0, width.value - THUMB) }] }));
  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };
  const percent = Math.round(value * 100);
  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.hit}
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent} percent` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          const next = snap(value + (e.nativeEvent.actionName === "increment" ? STEP * 2 : -STEP * 2));
          onChange(next);
          onRelease?.(next);
        }}
      >
        <View style={[styles.track, { backgroundColor: t.rangeTrack }]}>
          <Animated.View style={[styles.fill, { backgroundColor: color.accent }, fill]} />
        </View>
        <Animated.View style={[styles.thumb, { backgroundColor: color.accent }, thumb]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hit: { height: 16, justifyContent: "center" },
  track: { height: 8, borderRadius: 9999, overflow: "hidden" },
  fill: { height: "100%" },
  thumb: { position: "absolute", left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2 },
});
