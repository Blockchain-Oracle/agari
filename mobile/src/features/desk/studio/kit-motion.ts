import { Easing, withDelay, withTiming } from "react-native-reanimated";

/** web's `EASE = [0.22, 1, 0.36, 1]`, the desk's one curve. */
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * motion/react's `initial={{ opacity: 0, x|y: d }} animate={{ opacity: 1, x|y: 0 }}` as a Reanimated entering
 * animation: fade in while sliding `distance` points along one axis, after `delay` ms.
 */
export function slideIn({ axis = "y", distance, duration, delay = 0 }: { axis?: "x" | "y"; distance: number; duration: number; delay?: number }) {
  return () => {
    "worklet";
    const from = axis === "x" ? [{ translateX: distance }] : [{ translateY: distance }];
    const to = axis === "x" ? [{ translateX: withDelay(delay, withTiming(0, { duration, easing: EASE })) }] : [{ translateY: withDelay(delay, withTiming(0, { duration, easing: EASE })) }];
    return {
      initialValues: { opacity: 0, transform: from },
      animations: { opacity: withDelay(delay, withTiming(1, { duration, easing: EASE })), transform: to },
    };
  };
}

/** `initial={{ opacity: 0, scale: s }} animate={{ opacity: 1, scale: 1 }}`. */
export function scaleIn({ from, duration, delay = 0 }: { from: number; duration: number; delay?: number }) {
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 0, transform: [{ scale: from }] },
      animations: { opacity: withDelay(delay, withTiming(1, { duration, easing: EASE })), transform: [{ scale: withDelay(delay, withTiming(1, { duration, easing: EASE })) }] },
    };
  };
}
