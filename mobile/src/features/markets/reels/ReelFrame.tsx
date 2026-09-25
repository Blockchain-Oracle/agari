import { useEffect, type ReactNode } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { FONT } from "~/theme";
import { REEL_GRAIN } from "~/theme/web/reels";
import { useReelTokens } from "./tokens";

/**
 * reel.css `.reel-slot`: one page of the snap feed — the card centred with 8 / 12 px around it and 92 px kept
 * clear for the floating dock (`bottomClear`, which grows by however much higher the dock sits on this phone).
 */
export function ReelSlot({ height, bottomClear, children }: { height: number; bottomClear: number; children: ReactNode }) {
  return <View style={[styles.slot, { height, paddingBottom: bottomClear }]}>{children}</View>;
}

/**
 * reel.css `.reel-card` with its `.reel-grain` and `.reel-heat`: a 26 px-radius portrait card (max 460 wide) on the
 * theme's radial surface, a hairline border, the long drop shadow, the noise at 5 % and the vermilion heat line.
 */
export function ReelFrame({ children, flat, style }: { children: ReactNode; flat?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useReelTokens();
  return (
    <View style={[styles.shadow, { boxShadow: t.shadow }]}>
      <View
        style={[
          styles.card,
          { borderColor: t.ink10 },
          flat ? { backgroundColor: t.surfaceFlat } : { backgroundColor: t.surfaceFlat, experimental_backgroundImage: t.surface },
          style,
        ]}
      >
        {flat ? null : (
          <>
            <View pointerEvents="none" style={[styles.grain, { mixBlendMode: t.grainBlend }]}>
              <Image source={REEL_GRAIN} resizeMode="repeat" style={styles.fill} />
            </View>
            <View pointerEvents="none" style={[styles.heat, { experimental_backgroundImage: t.heat }]} />
          </>
        )}
        {children}
      </View>
    </View>
  );
}

/** reel-chrome.css `.reel-card.holding` (the reference's `EmptyReel`): the frame, flat, with a centred title and three pulsing dots. */
export function ReelHolding({ children }: { children: string }) {
  const t = useReelTokens();
  return (
    <ReelFrame flat style={styles.holding}>
      <Text style={[styles.holdingTitle, { color: t.ink }]}>{children}</Text>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 200, 400].map((delay) => (
          <Dot key={delay} delay={delay} color={t.vermilion} />
        ))}
      </View>
    </ReelFrame>
  );
}

/** yosuku part-08 `pulseDot`: 0.3 → 1 → 0.3 over 1.2 s, the three staggered by 0.2 s; still when motion is reduced. */
function Dot({ delay, color }: { delay: number; color: string }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(reduce ? 1 : 0.3);
  useEffect(() => {
    if (reduce) return;
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0.3, { duration: 600 })), -1));
    return () => cancelAnimation(o);
  }, [reduce, delay, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, a]} />;
}

const styles = StyleSheet.create({
  slot: { alignItems: "center", justifyContent: "center", paddingTop: 8, paddingHorizontal: 12 },
  shadow: { flex: 1, width: "100%", maxWidth: 460, borderRadius: 26 },
  card: { flex: 1, borderRadius: 26, borderWidth: 1, overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  grain: { ...StyleSheet.absoluteFillObject, zIndex: 30, opacity: 0.05 },
  heat: { position: "absolute", left: 0, right: 0, top: 0, height: 1, zIndex: 20 },
  holding: { alignItems: "center", justifyContent: "center", gap: 14, paddingLeft: 28, paddingRight: 88 },
  holdingTitle: { fontFamily: FONT.heading, fontSize: 20, lineHeight: 26, textAlign: "center" },
  dots: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 9999 },
});
