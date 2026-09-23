import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { FONT, RADIUS, useTheme } from "~/theme";

const THUMB = 52;
const PAD = 4;
/** 21st "Slide Action Button" (starc007): past 82 % of the track it commits, short of it the thumb springs back. */
const THRESHOLD = 0.82;
const TICKS = 6;

interface Props {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** The side's ink: profit for Up, loss for Down, the accent otherwise. */
  tone?: string;
}

/** Slide to confirm (21st "Slide Action Button", ported to the UI thread) with haptic ticks along the track. */
export function SlideToConfirm({ label, onConfirm, disabled, tone }: Props) {
  const { color } = useTheme();
  const ink = tone ?? color.accent;
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const max = Math.max(width - THUMB - PAD * 2, 1);
  const x = useSharedValue(0);
  const tick = useSharedValue(0);

  const commit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  };
  const tickHaptic = () => Haptics.selectionAsync();

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((e) => {
      x.value = Math.min(Math.max(e.translationX, 0), max);
      const step = Math.floor((x.value / max) * TICKS);
      if (step !== tick.value) {
        tick.value = step;
        runOnJS(tickHaptic)();
      }
    })
    .onEnd(() => {
      if (x.value / max >= THRESHOLD) {
        x.value = withTiming(max, { duration: 120 });
        runOnJS(commit)();
        x.value = withSpring(0, { damping: 18 });
      } else {
        x.value = withSpring(0, { damping: 16, stiffness: 180 });
      }
      tick.value = 0;
    });

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + THUMB + PAD }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, max * 0.35, max * 0.65], [1, 0.75, 0]) }));

  if (reduceMotion) {
    // Reduce Motion: the same commitment as one deliberate press.
    return (
      <Pressable onPress={commit} disabled={disabled} accessibilityRole="button" style={[styles.track, { backgroundColor: ink, opacity: disabled ? 0.5 : 1 }]}>
        <Text style={[styles.label, { color: color.onAccent }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={() => !disabled && commit()}
      style={[styles.track, { backgroundColor: color.surface2, borderColor: color.hairline, opacity: disabled ? 0.5 : 1 }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: ink }, fillStyle]} />
      <Animated.Text style={[styles.label, { color: color.ink }, labelStyle]}>{label}</Animated.Text>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, { backgroundColor: ink }, thumbStyle]}>
          <SymbolView name={{ ios: "chevron.right.2", android: "keyboard_double_arrow_right" }} size={20} tintColor={color.onAccent} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: THUMB + PAD * 2, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, justifyContent: "center", overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: RADIUS.full, opacity: 0.22 },
  label: { position: "absolute", alignSelf: "center", fontFamily: FONT.bodyStrong, fontSize: 16 },
  thumb: { position: "absolute", left: PAD, width: THUMB, height: THUMB, borderRadius: THUMB / 2, alignItems: "center", justifyContent: "center" },
});
