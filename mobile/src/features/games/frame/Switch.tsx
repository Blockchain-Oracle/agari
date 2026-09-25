import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useGamesTokens } from "./tokens";

/** web's shadcn `Switch` (default size): a 32 × 18 pill, the 16 px thumb sliding 14 px, vermilion when on. */
export function Switch({ value, onChange, disabled, label }: { value: boolean; onChange: (on: boolean) => void; disabled?: boolean; label: string }) {
  const { t, color } = useGamesTokens();
  const x = useSharedValue(value ? 14 : 0);
  useEffect(() => {
    x.value = withTiming(value ? 14 : 0, { duration: 150 });
  }, [value, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.track, { backgroundColor: value ? color.accent : t.switchOff }, disabled && styles.off]}
    >
      <Animated.View style={[styles.thumb, { backgroundColor: value ? t.switchThumb : color.ink }, thumb]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 32, height: 18, borderRadius: 9999, borderWidth: 1, borderColor: "transparent", justifyContent: "center" },
  thumb: { width: 16, height: 16, borderRadius: 9999 },
  off: { opacity: 0.5 },
});
