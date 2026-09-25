import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, Pattern, RadialGradient, Rect } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { useArcadeTokens } from "./palette";

/**
 * stage.css `.crt-screen` under the field: the glass gleam (an ellipse 65 % × 45 % at 28 % 22 %) and the two inset
 * shadows that darken the bezel's edge — both sit on the screen's own ground, beneath the picture, as on web.
 */
export function CrtGround() {
  const a = useArcadeTokens();
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="ar-gleam" cx="28%" cy="22%" rx="65%" ry="45%" fx="28%" fy="22%">
          <Stop offset="0" {...stopPaint(a.gleam)} />
          <Stop offset="0.7" {...stopPaint(a.gleam, 0)} />
        </RadialGradient>
        <RadialGradient id="ar-vignette" cx="50%" cy="50%" rx="56%" ry="60%" fx="50%" fy="50%">
          <Stop offset="0.72" {...stopPaint(a.vignetteFar, 0)} />
          <Stop offset="0.9" {...stopPaint(a.vignetteFar)} />
          <Stop offset="1" {...stopPaint(a.vignetteNear)} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#ar-gleam)" />
      <Rect width="100%" height="100%" fill="url(#ar-vignette)" />
    </Svg>
  );
}

/** Flicker keyframes (`crt-flicker`, 0.18 s): the veil's opacity at each tenth. */
const FLICKER = [0.03, 0.08, 0.02, 0.1, 0.04, 0.07, 0.03, 0.09, 0.04, 0.06] as const;

/**
 * `.crt-screen::before` and `::after` over the field: 2 px scanlines and the flicker veil, which reduced motion stills.
 */
export function CrtGlass({ reduced }: { reduced: boolean }) {
  const a = useArcadeTokens();
  const flicker = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(flicker);
      flicker.value = 0;
      return;
    }
    flicker.value = withRepeat(withSequence(...FLICKER.map((v) => withTiming(v, { duration: 18 }))), -1, false);
    return () => cancelAnimation(flicker);
  }, [reduced, flicker]);
  const veil = useAnimatedStyle(() => ({ opacity: flicker.value }));
  return (
    <>
      <Svg style={[StyleSheet.absoluteFill, styles.lines]} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <Pattern id="ar-scan" width={4} height={2} patternUnits="userSpaceOnUse">
            <Rect x={0} y={1} width={4} height={1} fill={a.scanline} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#ar-scan)" />
      </Svg>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, { backgroundColor: a.flicker }, veil]} />
    </>
  );
}

const styles = StyleSheet.create({
  lines: { zIndex: 2 },
  veil: { zIndex: 3 },
});
