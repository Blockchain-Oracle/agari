import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const STEP = 0.05;
const THUMB = 26;
const snap = (value: number) => Math.min(1, Math.max(0, Math.round(value / STEP) * STEP));

interface Props {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
  /** Fired once when a drag or tap lets go, at the level just set (web plays the click sample there). */
  onRelease?: (value: number) => void;
}

/**
 * One channel of web's settings well (`GameSettingsSheet` range inputs, 0–1 in 0.05 steps; zero is that
 * channel's mute), drawn as a touch slider: drag or tap anywhere on the track, a detent tick every step,
 * the level beside it in mono, and a speaker button that mutes or restores.
 */
// 21st: cnippet-dev/v-slider-11
export function VolumeSlider({ label, hint, value, onChange, onRelease }: Props) {
  const { color } = useTheme();
  const width = useSharedValue(0);
  const level = useSharedValue(value);
  const [dragging, setDragging] = useState(false);
  const lastAudible = useRef(value > 0 ? value : 1);
  const lastStep = useRef(value);

  useEffect(() => {
    if (!dragging) level.value = value;
    if (value > 0) lastAudible.current = value;
  }, [value, dragging, level]);

  const set = (next: number) => {
    const stepped = snap(next);
    if (stepped !== lastStep.current) {
      lastStep.current = stepped;
      haptic.select();
      onChange(stepped);
    }
  };
  const release = (next: number) => {
    setDragging(false);
    onRelease?.(snap(next));
  };

  const pan = Gesture.Pan()
    .hitSlop({ top: 12, bottom: 12 })
    .onBegin((event) => {
      runOnJS(setDragging)(true);
      const next = width.value > 0 ? event.x / width.value : level.value;
      level.value = Math.min(1, Math.max(0, next));
      runOnJS(set)(level.value);
    })
    .onUpdate((event) => {
      if (width.value <= 0) return;
      level.value = Math.min(1, Math.max(0, event.x / width.value));
      runOnJS(set)(level.value);
    })
    .onFinalize(() => {
      runOnJS(release)(level.value);
    });

  const fill = useAnimatedStyle(() => ({ width: `${level.value * 100}%` }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: level.value * width.value - THUMB / 2 }] }));
  const onLayout = (event: LayoutChangeEvent) => {
    width.value = event.nativeEvent.layout.width;
  };

  const percent = Math.round(value * 100);
  const muted = value === 0;
  const icon = muted
    ? { ios: "speaker.slash.fill", android: "volume_off" }
    : value < 0.5
      ? { ios: "speaker.wave.1.fill", android: "volume_down" }
      : { ios: "speaker.wave.2.fill", android: "volume_up" };

  const toggle = () => {
    haptic.tap();
    const next = muted ? lastAudible.current : 0;
    onChange(next);
    onRelease?.(next);
  };
  const nudge = (delta: number) => {
    const next = snap(value + delta);
    onChange(next);
    onRelease?.(next);
  };

  return (
    <View style={styles.root}>
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{label}</Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{hint}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={muted ? `Unmute ${label.toLowerCase()}` : `Mute ${label.toLowerCase()}`}
          hitSlop={6}
          style={({ pressed }) => [styles.mute, { backgroundColor: pressed ? color.surface3 : color.surface2 }]}
        >
          <SymbolView name={icon as never} size={18} tintColor={muted ? color.inkMuted : color.accent} />
        </Pressable>
        <GestureDetector gesture={pan}>
          <View
            style={styles.hit}
            onLayout={onLayout}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent} percent` }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(event) => nudge(event.nativeEvent.actionName === "increment" ? STEP * 2 : -STEP * 2)}
          >
            <View style={[styles.track, { backgroundColor: color.borderStrong }]}>
              <Animated.View style={[styles.fill, { backgroundColor: color.accent }, fill]} />
            </View>
            <Animated.View style={[styles.thumb, { backgroundColor: color.ink, borderColor: color.ground }, thumb]} />
          </View>
        </GestureDetector>
        <Text style={[styles.readout, { color: muted ? color.inkMuted : color.ink }]}>{percent}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  mute: { width: 44, height: 44, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center" },
  hit: { flex: 1, height: 44, justifyContent: "center" },
  track: { height: 8, borderRadius: RADIUS.full, overflow: "hidden" },
  fill: { height: "100%", borderRadius: RADIUS.full },
  thumb: { position: "absolute", left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3 },
  readout: { fontFamily: FONT.dataStrong, fontSize: 14, width: 34, textAlign: "right", fontVariant: ["tabular-nums"] },
});
