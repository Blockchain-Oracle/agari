import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * web's gradient washes drawn behind a card's content (React Native has no CSS gradients): a vertical fade
 * (`linear-gradient(180deg, X, transparent N%)`) and a corner glow (`radial-gradient(… at x y, X, transparent N%)`).
 * `radius` clips the wash to the card's corners.
 */
export function LinearWash({ from, to = "transparent", until = 1, radius = 0 }: { from: string; to?: string; until?: number; radius?: number }) {
  const id = `lw${useId().replace(/:/g, "")}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset={until} stopColor={to} stopOpacity={to === "transparent" ? 0 : 1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** A radial glow centred at (cx, cy) as fractions of the box, fading to nothing at `until` of its radii. */
export function RadialWash({ color, cx = 0, cy = 0, rx = 1.2, ry = 0.9, until = 0.55, radius = 0 }: { color: string; cx?: number; cy?: number; rx?: number; ry?: number; until?: number; radius?: number }) {
  const id = `rw${useId().replace(/:/g, "")}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx={String(cx)} cy={String(cy)} rx={String(rx)} ry={String(ry)} fx={String(cx)} fy={String(cy)} gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor={color} />
            <Stop offset={until} stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
