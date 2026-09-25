import { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useGames } from "~/features/games/shell/context";

/** duel.css `du-pulse`: a 6 px dot that dims to 30 % and back every 1.2 s; steady when motion is reduced. */
export function PulseDot({ color, size = 6, style }: { color: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const { reducedMotion } = useGames();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(o);
      o.value = 1;
      return;
    }
    o.value = withRepeat(withTiming(0.3, { duration: 600 }), -1, true);
    return () => cancelAnimation(o);
  }, [reducedMotion, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: 9999, backgroundColor: color }, a, style]} />;
}
