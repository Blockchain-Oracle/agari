import {
  createRideState,
  createRng,
  qFromTarget,
  recordRideInput,
  RIDE_START_Q,
  rideScoreOf,
  stepRide,
  targetFromQ,
  ticksToMs,
  type ArcadeRunConfig,
  type RideState,
  type Rng,
} from "@agari/core/games/arcade";
import type { RideCue, RideHud } from "@/features/games/arcade/RideCanvas";
import { createRideFx, drawRide } from "@/features/games/arcade/ride-draw";
import { IDLE_SEED, type ArcadeRun, type RunEnd } from "@/features/games/arcade/run";
import type { ArcadeView } from "@/features/games/arcade/useArcadeLoop";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ArcadeSurface, type SurfaceHandle } from "./ArcadeSurface";
import { useArcadeFrames, type FieldBand, type FrameStats, type LoopDriver } from "./useArcadeFrames";

/**
 * web's `RideCanvas.tsx`, native: the engine's state, the trace and the loop in refs, React seeing a throttled
 * HUD and one call when the run ends. Web's wheel is the pointer's height on the screen; here it is the finger's
 * height — touch anywhere on the field and drag, the dot goes where your finger is. Every input the step consumed
 * is in the trace by the tick it applied to, so the run the server replays is the run the player played.
 */
const HUD_EVERY_TICKS = 3;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

interface Props {
  run: ArcadeRun | null;
  reduced: boolean;
  onHud: (hud: RideHud) => void;
  onEnd: (end: RunEnd) => void;
  onCue: (cue: RideCue) => void;
  statsRef: RefObject<FrameStats>;
  /** The full-screen stage: the whole screen takes the finger, the picture sits in this band. */
  band?: FieldBand | null;
  /** A paused run holds its tick; the trace is by tick, so a pause never changes the replay. */
  paused?: boolean;
}

export function RideField({ run, reduced, onHud, onEnd, onCue, statsRef, band = null, paused = false }: Props) {
  const surfaceRef = useRef<SurfaceHandle>(null);
  const stateRef = useRef<RideState>(createRideState(createRng(IDLE_SEED), { calm: false }));
  const rngRef = useRef<Rng>(createRng(IDLE_SEED));
  const configRef = useRef<ArcadeRunConfig>({ calm: false });
  const traceRef = useRef<number[]>([]);
  const targetRef = useRef(targetFromQ(RIDE_START_Q));
  const heightRef = useRef(0);
  const grabRef = useRef<{ y: number; target: number } | null>(null);
  const fxRef = useRef(createRideFx());
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const runRef = useRef<ArcadeRun | null>(null);
  const [running, setRunning] = useState(false);

  const callbacks = useRef({ onHud, onEnd, onCue });
  callbacks.current = { onHud, onEnd, onCue };

  const hud = useCallback((state: RideState) => {
    callbacks.current.onHud({
      score: rideScoreOf(state),
      multiplier: state.mult,
      grip: state.grip,
      elapsedSec: state.elapsedSec,
      onLine: state.onLine,
      intensity: state.difficulty,
    });
  }, []);

  const driverRef = useRef<LoopDriver>({
    step() {
      const state = stateRef.current;
      const active = runRef.current;
      if (!active || state.over) return;
      const q = qFromTarget(targetRef.current);
      recordRideInput(traceRef.current, state.tick, q);
      stepRide(state, q, rngRef.current, configRef.current);
      if (state.regained) callbacks.current.onCue({ kind: "regain" });
      if (state.milestoneHit) callbacks.current.onCue({ kind: "milestone", mult: state.milestoneHit });
      if (state.tick % HUD_EVERY_TICKS === 0) hud(state);
      if (state.over) {
        hud(state);
        setRunning(false);
        callbacks.current.onEnd({
          game: "line-rider",
          seed: active.seed,
          calm: active.calm,
          score: rideScoreOf(state),
          ticks: state.tick,
          durationMs: ticksToMs(state.tick),
          trace: traceRef.current,
        });
      }
    },
    draw(view: ArcadeView, alpha: number, nowMs: number) {
      drawRide(view, stateRef.current, alpha, nowMs, fxRef.current, reducedRef.current);
    },
  });

  useArcadeFrames(driverRef, surfaceRef, running && !paused, statsRef);

  // A new run: fresh dice, a fresh state on the run's seed, the wheel centred.
  useEffect(() => {
    if (!run) return;
    runRef.current = run;
    rngRef.current = createRng(run.seed);
    configRef.current = { calm: run.calm };
    stateRef.current = createRideState(rngRef.current, configRef.current);
    traceRef.current = [];
    targetRef.current = targetFromQ(RIDE_START_Q);
    fxRef.current = createRideFx();
    hud(stateRef.current);
    setRunning(true);
    return () => {
      runRef.current = null;
    };
  }, [run, hud]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .enabled(running && !paused)
        .onBegin((event) => {
          if (band) {
            // Full screen: the thumb need not cover the line — the dot moves with the drag, one band pixel for one.
            grabRef.current = { y: event.y, target: targetRef.current };
            return;
          }
          if (heightRef.current > 0) targetRef.current = clamp01(1 - event.y / heightRef.current);
        })
        .onUpdate((event) => {
          if (band) {
            const grab = grabRef.current;
            if (grab && band.height > 0) targetRef.current = clamp01(grab.target - (event.y - grab.y) / band.height);
            return;
          }
          if (heightRef.current > 0) targetRef.current = clamp01(1 - event.y / heightRef.current);
        }),
    [running, paused, band],
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(event) => {
          heightRef.current = event.nativeEvent.layout.height;
        }}
      >
        {band ? (
          <View pointerEvents="none" style={[styles.band, { top: band.top, height: band.height }]}>
            <ArcadeSurface ref={surfaceRef} x0={band.x0} />
          </View>
        ) : (
          <ArcadeSurface ref={surfaceRef} />
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ band: { position: "absolute", left: 0, right: 0 } });
