import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

/** part-17.css easings: --e-out, --e-emph, --e-draw. */
export const E_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const E_EMPH = Easing.bezier(0.2, 0, 0, 1);
export const E_DRAW = Easing.bezier(0.65, 0, 0.35, 1);

/** A value that runs 0 → 1 once, after `delay` ms (a CSS animation with `both` fill). */
export function useOnce(duration: number, delay: number, easing = E_OUT, native = true): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.timing(value, { toValue: 1, duration, delay, easing, useNativeDriver: native });
    run.start();
    return () => run.stop();
  }, [value, duration, delay, easing, native]);
  return value;
}

/** A value that runs 0 → 1 forever (a CSS `infinite` animation). */
export function useLoop(duration: number, easing = Easing.linear, native = true): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.loop(Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: native }));
    run.start();
    return () => run.stop();
  }, [value, duration, easing, native]);
  return value;
}

/** part-17.css `.xt-boot` (xt-up 0.62s --e-out): fades up 11 px after its animation-delay. */
export function Boot({ delay, style, children }: { delay: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const t = useOnce(620, delay);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [11, 0] });
  return <Animated.View style={[style, { opacity: t, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export { loopAt, onceAt, svgRepaint, useSvgClock } from "~/components/ui/svg-clock";
