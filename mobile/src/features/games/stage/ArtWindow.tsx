import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { BearMark, BullMark, CoinMark } from "../shell/PixelArt";
import { useLean } from "./lean";
import { useStageTokens } from "./tokens";
import { useStageFeel } from "./useStageFeel";

const SCREWS = [
  { top: 4, left: 4 },
  { top: 4, right: 4 },
  { bottom: 4, left: 4 },
  { bottom: 4, right: 4 },
] as const;

/** crt-flicker's steps (0.18 s a cycle), as opacities of the dimming layer. */
const FLICKER = [0.03, 0.08, 0.02, 0.1, 0.04, 0.07, 0.03, 0.09, 0.04, 0.06];

/**
 * stage.css `.st-art.crt-screen`: a 132 px window with a screw in each corner, a glass gleam at 28 % / 22 %, an edge
 * vignette, 2 px scanlines and a flicker (still when motion is reduced). The coin rests there with a vermilion glow;
 * the bull takes its place on an upward lean and the bear on a downward one, grown and tilted in the side's colour.
 */
export function ArtWindow() {
  const { s, color } = useStageTokens();
  const lean = useLean();
  const { reducedMotion } = useStageFeel();
  const flicker = useSharedValue(0.03);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(flicker);
      flicker.value = 0;
      return;
    }
    flicker.value = withRepeat(withSequence(...FLICKER.map((o) => withTiming(o, { duration: 18 }))), -1, false);
    return () => cancelAnimation(flicker);
  }, [reducedMotion, flicker]);
  const dim = useAnimatedStyle(() => ({ opacity: flicker.value }));

  const glow = lean === "up" ? color.profit : lean === "down" ? color.loss : s.artGlow;
  const lift = lean ? { transform: [{ scale: 1.18 }, { rotate: lean === "up" ? "-4deg" : "4deg" }] } : null;
  return (
    <View
      style={[styles.art, { borderColor: s.bandBorder, boxShadow: `inset 0 0 18px ${s.artVignetteNear}, inset 0 0 60px ${s.artVignetteFar}` }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="st-gleam" cx="28%" cy="22%" rx="65%" ry="45%" fx="28%" fy="22%">
            <Stop offset="0" stopColor={s.artGleam} />
            <Stop offset="0.7" stopColor={s.artGleam} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#st-gleam)" />
      </Svg>
      <View style={[styles.mark, { shadowColor: glow }, lift]}>
        {lean === "up" ? <BullMark size={88} /> : lean === "down" ? <BearMark size={88} /> : <CoinMark size={88} />}
      </View>
      <View
        pointerEvents="none"
        style={[styles.layer, styles.scan, { experimental_backgroundImage: `linear-gradient(transparent 50%, ${s.scanline} 50%)` }]}
      />
      <Animated.View pointerEvents="none" style={[styles.layer, { backgroundColor: s.flicker }, dim]} />
      {SCREWS.map((at, i) => (
        <View key={i} style={[styles.screw, at, { backgroundColor: s.screw }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { height: 132, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  mark: { shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  layer: { ...StyleSheet.absoluteFill },
  scan: { experimental_backgroundSize: "100% 2px", mixBlendMode: "overlay" },
  screw: { position: "absolute", width: 6, height: 6, zIndex: 4 },
});
