import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

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

/**
 * A value that eases from wherever it is to `target` over `duration` whenever `target` changes (a CSS transition),
 * drawn the `useSvgClock` way: `repaint` goes off the `<Svg>`'s width while it moves. `duration` 0 jumps.
 */
export function useSvgTween(target: number, duration: number, easing: (t: number) => number, from = 0): { value: number; repaint: number } {
  const [frame, setFrame] = useState(0);
  const run = useRef({ from, to: from, start: 0 });
  const current = useRef(from);
  useEffect(() => {
    run.current = { from: current.current, to: target, start: Date.now() };
    if (duration <= 0) {
      current.current = target;
      setFrame((f) => f + 1);
      return;
    }
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - run.current.start) / duration);
      current.current = run.current.from + (run.current.to - run.current.from) * easing(t);
      setFrame((f) => f + 1);
      if (t >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [target, duration, easing]);
  return { value: current.current, repaint: (frame % 2) * 0.001 };
}
