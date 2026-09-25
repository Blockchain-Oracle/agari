import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, AppState, Easing, type StyleProp, type ViewStyle } from "react-native";

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

/**
 * Milliseconds since mount, re-rendered at `fps` while the app is in front. react-native-svg (15.15, Fabric, iOS)
 * repaints its canvas on a layout pass, not when a child's props change — neither Animated nor Reanimated drew a frame
 * (the hex, the flows and the attack dot sat still) — so an SVG's motion is computed from this clock in render and
 * the `<Svg>` takes `svgRepaint(ms)` off its width, which forces the redraw.
 */
export function useSvgClock(fps = 30, stopAtMs = Number.POSITIVE_INFINITY): number {
  const [ms, setMs] = useState(0);
  const held = useRef(0);
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    let began = 0;
    const run = () => {
      if (id !== null) return;
      began = Date.now() - held.current;
      id = setInterval(() => {
        const now = Date.now() - began;
        setMs(Math.min(now, stopAtMs));
        // A one-shot drawing holds its last frame and stops ticking.
        if (now >= stopAtMs) hold();
      }, 1000 / fps);
    };
    const hold = () => {
      if (id === null) return;
      clearInterval(id);
      id = null;
      held.current = Date.now() - began;
    };
    run();
    // A backgrounded app draws nothing; the clock holds and resumes where it was.
    const sub = AppState.addEventListener("change", (state) => (state === "active" ? run() : hold()));
    return () => {
      sub.remove();
      hold();
    };
  }, [fps, stopAtMs]);
  return ms;
}

/** A width change too small to see that alternates each frame, so the `<Svg>` re-lays out and repaints. */
export function svgRepaint(ms: number): number {
  return (Math.floor(ms / 33) % 2) * 0.001;
}

/** A CSS animation's progress at `ms`: 0 → 1 once after `delay` (fill both), eased. */
export function onceAt(ms: number, duration: number, delay: number, easing: (t: number) => number): number {
  return easing(Math.min(1, Math.max(0, (ms - delay) / duration)));
}

/** An `infinite` linear animation's progress at `ms`. */
export function loopAt(ms: number, duration: number): number {
  return (ms % duration) / duration;
}
