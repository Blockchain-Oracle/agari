import { STEP_MS } from "@agari/core/games/arcade";
import type { ArcadeView } from "@/features/games/arcade/useArcadeLoop";
import { useIsFocused } from "expo-router";
import { useEffect, useRef, type RefObject } from "react";
import { useDocumentVisible } from "@/lib/visibility";
import { ARCADE_PALETTE } from "./palette";
import { CanvasRecorder } from "./recorder";
import type { SurfaceHandle } from "./ArcadeSurface";

/**
 * web's `useArcadeLoop` + `useArcadeSurface` on the phone.
 *
 * The simulation steps at exactly 60 Hz whatever the display does (the same accumulator, the same tenth-of-a-
 * second stall clamp), and the draw gets the leftover fraction to interpolate. The draw is web's own module
 * painting into a `CanvasRecorder` whose frame the SVG surface shows. The view is the field itself (scale 1,
 * the viewBox does the rest). If painting at 60 fps runs long — the average frame over the last half second
 * above 24 ms — the loop paints every other frame instead, which the sim does not notice. The loop stops when
 * the screen loses focus or the app leaves the foreground, and restarts with a fresh clock.
 */
export interface LoopDriver {
  step(): void;
  draw(view: ArcadeView, alpha: number, nowMs: number): void;
}

export interface FrameStats {
  /** Mean time between painted frames, ms. */
  frameMs: number;
  /** Mean JS time per painted frame (steps + record + hand-off), ms. */
  workMs: number;
  /** 60, or 30 once frames ran long. */
  targetFps: 60 | 30;
}

const MAX_FRAME_MS = 100;
const WINDOW = 30;
const SLOW_FRAME_MS = 24;

export const FRESH_STATS: FrameStats = { frameMs: 0, workMs: 0, targetFps: 60 };

/** Where the full-screen stage draws the field: a band of the screen, and the field units trimmed behind the player. */
export interface FieldBand {
  top: number;
  height: number;
  x0: number;
}

/** `statsRef` is the caller's: the loop keeps the measured frame times in it. */
export function useArcadeFrames(
  driverRef: RefObject<LoopDriver>,
  surfaceRef: RefObject<SurfaceHandle | null>,
  running: boolean,
  statsRef: RefObject<FrameStats>,
): void {
  const recorderRef = useRef(new CanvasRecorder());
  const viewRef = useRef<ArcadeView>({
    ctx: recorderRef.current as unknown as CanvasRenderingContext2D,
    w: 640,
    h: 360,
    dpr: 1,
    scale: 1,
    palette: ARCADE_PALETTE,
  });
  const visible = useDocumentVisible();
  const focused = useIsFocused();

  /** One recorded frame onto the surface. */
  const paintRef = useRef((alpha: number, nowMs: number) => {
    const recorder = recorderRef.current;
    recorder.begin();
    driverRef.current.draw(viewRef.current, alpha, nowMs);
    surfaceRef.current?.paint(recorder.finish());
  });

  // The idle picture: paint once on mount so the screen is never blank behind the title plate.
  useEffect(() => {
    paintRef.current(1, performance.now());
  }, []);

  useEffect(() => {
    if (!running || !visible || !focused) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastPaint = 0;
    let skip = false;
    const frames: number[] = [];
    const works: number[] = [];

    const frame = (now: number) => {
      const started = performance.now();
      const elapsed = Math.min(MAX_FRAME_MS, now - last);
      last = now;
      acc += elapsed;
      while (acc >= STEP_MS) {
        driverRef.current.step();
        acc -= STEP_MS;
      }
      skip = statsRef.current.targetFps === 30 ? !skip : false;
      if (!skip) {
        paintRef.current(acc / STEP_MS, now);
        if (lastPaint) frames.push(now - lastPaint);
        lastPaint = now;
        works.push(performance.now() - started);
        if (frames.length >= WINDOW) {
          const frameMs = frames.reduce((a, b) => a + b, 0) / frames.length;
          const workMs = works.reduce((a, b) => a + b, 0) / works.length;
          const slow = statsRef.current.targetFps === 60 && frameMs > SLOW_FRAME_MS;
          statsRef.current = { frameMs, workMs, targetFps: slow ? 30 : statsRef.current.targetFps };
          frames.length = 0;
          works.length = 0;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, visible, focused, driverRef, statsRef]);
}
