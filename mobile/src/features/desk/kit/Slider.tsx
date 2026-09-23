import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, useTheme } from "~/theme";

const THUMB = 26;

interface Props {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  /** The value as the reader sees it ("40%", "$50"), shown left of the track. */
  display: string;
  /** The fill's colour (a company's brand mix); the accent otherwise. */
  tone?: string;
}

/**
 * web's desk-kit Slider (21st "value left" #10339) for touch: the value sits left of the track, the thumb follows a
 * drag or a tap and snaps to the step, and VoiceOver's swipe up/down moves it one step (adjustable role).
 */
export function Slider({ value, onChange, min, max, step, label, display, tone }: Props) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const ink = tone ?? color.accent;
  const share = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;

  const snap = (x: number) => {
    if (width <= 0) return;
    const raw = min + Math.min(1, Math.max(0, x / width)) * (max - min);
    const stepped = Math.round(raw / step) * step;
    const next = Number(Math.min(max, Math.max(min, stepped)).toFixed(4));
    if (next !== value) onChange(next);
  };
  const nudge = (dir: 1 | -1) => {
    const next = Number(Math.min(max, Math.max(min, value + dir * step)).toFixed(4));
    if (next !== value) {
      haptic.select();
      onChange(next);
    }
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onBegin((e) => runOnJS(snap)(e.x))
    .onUpdate((e) => runOnJS(snap)(e.x))
    .onEnd(() => runOnJS(haptic.select)());
  const tap = Gesture.Tap().onEnd((e) => runOnJS(snap)(e.x));

  return (
    <View style={styles.row}>
      <Text style={[styles.value, { color: color.ink }]} numberOfLines={1}>
        {display}
      </Text>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View
          style={styles.hit}
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
          <View style={[styles.thumb, { left: Math.max(0, share * width - THUMB / 2), borderColor: ink, backgroundColor: color.ground }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  value: { fontFamily: FONT.dataStrong, fontSize: 14, minWidth: 56 },
  hit: { flex: 1, height: 44, justifyContent: "center" },
  track: { height: 6, borderRadius: RADIUS.full, overflow: "hidden" },
  fill: { height: 6 },
  thumb: { position: "absolute", width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3, top: (44 - THUMB) / 2 },
});
