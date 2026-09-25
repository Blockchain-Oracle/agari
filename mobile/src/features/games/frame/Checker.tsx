import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Defs, Pattern, Polygon, Rect } from "react-native-svg";
import { useGames } from "~/features/games/shell/context";
import { useGamesTokens } from "./tokens";

const S = 128;
const k = 0.52 * S;
const h = 0.5 * S;
/**
 * games.css `.gm-frame`'s four gradient layers, each a corner triangle of the 128 px tile at its own background
 * offset: 45° 26% (bottom-left) at 0 0, 135° 26% (top-left) at 64 0, 45° from 75% (top-right) at 64 −64 and
 * 135° from 75% (bottom-right) at 0 64.
 */
const LAYERS: ReadonlyArray<{ points: (x: number, y: number) => string; dx: number; dy: number }> = [
  { points: (x, y) => `${x},${y + S} ${x + k},${y + S} ${x},${y + S - k}`, dx: 0, dy: 0 },
  { points: (x, y) => `${x},${y} ${x + k},${y} ${x},${y + k}`, dx: 64, dy: 0 },
  { points: (x, y) => `${x + S},${y} ${x + h},${y} ${x + S},${y + h}`, dx: 64, dy: -64 },
  { points: (x, y) => `${x + S},${y + S} ${x + h},${y + S} ${x + S},${y + h}`, dx: 0, dy: 64 },
];
const SHIFTS = [0, -S, S] as const;

/**
 * The checker canvas behind every games page (games.css `gm-checker-drift`): one tile of ink over the ground,
 * drifting one tile diagonally every 12 s, still when motion is reduced. Fills its parent; draw it first.
 */
export function Checker() {
  const { t } = useGamesTokens();
  const { reducedMotion } = useGames();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(drift);
      drift.value = 0;
      return;
    }
    drift.value = 0;
    drift.value = withRepeat(withTiming(S, { duration: 12_000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(drift);
  }, [reducedMotion, drift]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value }, { translateY: drift.value }] }));

  return (
    <View pointerEvents="none" style={styles.clip}>
      <Animated.View style={[styles.sheet, moving]}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="gm-tile" width={S} height={S} patternUnits="userSpaceOnUse">
              {LAYERS.flatMap((layer, i) =>
                SHIFTS.flatMap((sx) =>
                  SHIFTS.map((sy) => <Polygon key={`${i}-${sx}-${sy}`} points={layer.points(layer.dx + sx, layer.dy + sy)} fill={t.tile} />),
                ),
              )}
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#gm-tile)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  sheet: { position: "absolute", left: -S, top: -S, right: 0, bottom: -S },
});
