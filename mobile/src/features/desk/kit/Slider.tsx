import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { useDeskTheme } from "./theme";

const THUMB = 20;

interface Props {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  /** The value as the reader sees it ("40%", "$50"), shown left of the track. */
  display: string;
  /** The fill's and the thumb ring's colour (a company's brand mix); the accent otherwise. */
  tone?: string;
  disabled?: boolean;
}

/**
 * `.dkit-slider` (21st "value left" #10339): a 64 px value column, then a 6 px track on a 28 px control with a 20 px
 * ink thumb ringed in the tone. A drag or a tap snaps to the step; VoiceOver's swipe moves it one step (adjustable).
 */
export function Slider({ value, onChange, min, max, step, label, display, tone, disabled }: Props) {
  const { color, t } = useDeskTheme();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const ink = tone ?? color.accent;
  const share = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;

  const snap = (x: number) => {
    if (width <= 0 || disabled) return;
    const raw = min + Math.min(1, Math.max(0, x / width)) * (max - min);
    const next = Number(Math.min(max, Math.max(min, Math.round(raw / step) * step)).toFixed(4));
    if (next !== value) onChange(next);
  };
  const nudge = (dir: 1 | -1) => {
    const next = Number(Math.min(max, Math.max(min, value + dir * step)).toFixed(4));
    if (next !== value && !disabled) {
      haptic.select();
      onChange(next);
    }
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onBegin((e) => {
      runOnJS(setDragging)(true);
      runOnJS(snap)(e.x);
    })
    .onUpdate((e) => runOnJS(snap)(e.x))
    .onFinalize(() => {
      runOnJS(setDragging)(false);
      runOnJS(haptic.select)();
    });
  const tap = Gesture.Tap().onEnd((e) => runOnJS(snap)(e.x));

  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <Text style={[styles.value, { color: color.ink }]} numberOfLines={1}>
        {display}
      </Text>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View
          style={styles.control}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: display }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
        >
          <View style={[styles.track, { backgroundColor: color.surface2 }]}>
            <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: ink }]} />
          </View>
          <View
            style={[
              styles.thumb,
              { left: share * width - THUMB / 2, borderColor: ink, backgroundColor: color.ink, boxShadow: `0 2px 8px ${t.shadow}` },
              dragging && styles.big,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%" },
  disabled: { opacity: 0.45 },
  value: { width: 64, fontFamily: FONT.bodyStrong, fontSize: 14, fontVariant: ["tabular-nums"] },
  control: { flex: 1, height: 28, justifyContent: "center" },
  track: { height: 6, borderRadius: 9999, overflow: "hidden" },
  fill: { height: 6, borderRadius: 9999 },
  thumb: { position: "absolute", top: (28 - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3 },
  big: { transform: [{ scale: 1.12 }] },
});
