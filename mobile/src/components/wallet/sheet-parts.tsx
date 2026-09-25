import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { ClipPath, Defs, LinearGradient, Path, Rect } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";

const CLOSE_PHONE =
  "M2.13388 0.366117C1.64573 -0.122039 0.854272 -0.122039 0.366117 0.366117C-0.122039 0.854272 -0.122039 1.64573 0.366117 2.13388L3.98223 5.75L0.366117 9.36612C-0.122039 9.85427 -0.122039 10.6457 0.366117 11.1339C0.854272 11.622 1.64573 11.622 2.13388 11.1339L5.75 7.51777L9.36612 11.1339C9.85427 11.622 10.6457 11.622 11.1339 11.1339C11.622 10.6457 11.622 9.85427 11.1339 9.36612L7.51777 5.75L11.1339 2.13388C11.622 1.64573 11.622 0.854272 11.1339 0.366117C10.6457 -0.122039 9.85427 -0.122039 9.36612 0.366117L5.75 3.98223L2.13388 0.366117Z";
const BACK =
  "M0.99707 8.6543C0.99707 9.08496 1.15527 9.44531 1.51562 9.79688L8.16016 16.3096C8.43262 16.5732 8.74902 16.7051 9.13574 16.7051C9.90918 16.7051 10.5508 16.0811 10.5508 15.3076C10.5508 14.9121 10.3838 14.5605 10.0938 14.2705L4.30176 8.64551L10.0938 3.0293C10.3838 2.74805 10.5508 2.3877 10.5508 2.00098C10.5508 1.23633 9.90918 0.603516 9.13574 0.603516C8.74902 0.603516 8.43262 0.735352 8.16016 0.999023L1.51562 7.51172C1.15527 7.85449 1.00586 8.21484 0.99707 8.6543Z";
const SPIN =
  "M10.5 3C6.35786 3 3 6.35786 3 10.5C3 14.6421 6.35786 18 10.5 18C11.3284 18 12 18.6716 12 19.5C12 20.3284 11.3284 21 10.5 21C4.70101 21 0 16.299 0 10.5C0 4.70101 4.70101 0 10.5 0C16.299 0 21 4.70101 21 10.5C21 11.3284 20.3284 12 19.5 12C18.6716 12 18 11.3284 18 10.5C18 6.35786 14.6421 3 10.5 3Z";

/** RainbowKit's phone close: a 30 pt surface-2 disc (no border below 768 px) holding its 11.5 pt cross. */
export function CloseButton({ onPress }: { onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={WALLET_MODAL.close}
      hitSlop={10}
      style={({ pressed }) => [styles.close, { backgroundColor: color.surface2 }, pressed && styles.shrinkSm]}
    >
      <Svg width={11.5} height={11.5} viewBox="0 0 11.5 11.5">
        <Path d={CLOSE_PHONE} fill={color.inkSecondary} />
      </Svg>
    </Pressable>
  );
}

/** RainbowKit's back chevron in the accent, padded to a 16 pt touch box as the phone sheet places it. */
export function BackButton({ onPress }: { onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={WALLET_MODAL.back} style={({ pressed }) => [styles.back, pressed && styles.shrinkSm]}>
      <Svg width={11} height={17} viewBox="0 0 11 17">
        <Path d={BACK} fill={color.accent} />
      </Svg>
    </Pressable>
  );
}

/** RainbowKit's `ActionButton`: accent primary or surface-2 secondary; large drops the fill, small drops the border. */
export function ActionButton({ label, onPress, secondary = false, size = "medium" }: { label: string; onPress: () => void; secondary?: boolean; size?: "medium" | "large" | "small" }) {
  const { color } = useTheme();
  const fill = size === "large" ? "transparent" : secondary ? color.surface2 : color.accent;
  const ink = secondary ? color.accent : color.creamInk;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        size === "large" ? styles.actionLarge : size === "small" ? styles.actionSmall : null,
        { backgroundColor: fill, borderColor: color.hairline },
        pressed && styles.shrinkSm,
      ]}
    >
      <Text style={[styles.actionText, size === "large" ? styles.actionTextLarge : null, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

/** RainbowKit's `SpinnerIcon`: its open ring, swept from clear to the ink, turning every 3 s. */
export function Spinner({ size = 21, tint }: { size?: number; tint?: string }) {
  const { color } = useTheme();
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
  }, [turn]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  const ink = tint ?? color.inkSecondary;
  return (
    <Animated.View style={[{ width: size, height: size }, spin]} accessibilityRole="progressbar" accessibilityLabel={WALLET_MODAL.status.loading}>
      <Svg width={size} height={size} viewBox="0 0 21 21">
        <Defs>
          <ClipPath id="wm-spin">
            <Path d={SPIN} />
          </ClipPath>
          <LinearGradient id="wm-sweep" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" {...stopPaint(ink, 0)} />
            <Stop offset="0.8" {...stopPaint(ink, 1)} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={21} height={21} fill="url(#wm-sweep)" clipPath="url(#wm-spin)" />
      </Svg>
    </Animated.View>
  );
}

/** A wallet's icon at one of RainbowKit's sizes, rounded as they are, with the hairline ring unless `ring` is off. */
export function WalletIcon({ size, ring = true, children }: { size: 28 | 44 | 48 | 60; ring?: boolean; children: ReactNode }) {
  const { color } = useTheme();
  const radius = { 28: 6, 44: 10, 48: 10, 60: 13 }[size];
  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: "hidden" }}>
      {children}
      {ring ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: color.hairline }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  close: { width: 30, height: 30, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  back: { padding: 16, paddingLeft: 20 },
  shrinkSm: { transform: [{ scale: 0.9 }] },
  action: { height: 28, borderWidth: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  actionLarge: { height: "auto", paddingVertical: 10, paddingHorizontal: 24 },
  actionSmall: { height: "auto", paddingVertical: 5, paddingHorizontal: 10, borderWidth: 0 },
  actionText: { fontFamily: FONT.bodyBold, fontSize: 14, lineHeight: 18 },
  actionTextLarge: { fontSize: 16, lineHeight: 20 },
});
