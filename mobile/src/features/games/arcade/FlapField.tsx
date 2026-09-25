import {
  createFlapState,
  createRng,
  stepFlap,
  ticksToMs,
  type ArcadeRunConfig,
  type FlapState,
  type Rng,
} from "@agari/core/games/arcade";
import type { FlapCue, FlapHud } from "@/features/games/arcade/FlapCanvas";
import { createFlapFx, drawFlap, flapFxPress } from "@/features/games/arcade/flap-draw";
import { IDLE_SEED, type ArcadeRun, type RunEnd } from "@/features/games/arcade/run";
import type { ArcadeView } from "@/features/games/arcade/useArcadeLoop";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ArcadeSurface, type SurfaceHandle } from "./ArcadeSurface";
import { useArcadeFrames, type FieldBand, type FrameStats, type LoopDriver } from "./useArcadeFrames";

/**
 * web's `FlapCanvas.tsx`, native — the ride's twin with one bit of input. A touch-down anywhere on the field
 * is a press; a press between two steps is held until the next step consumes it, so a tap is never lost to
 * timing, and the tick it applied to is what the trace records. The engine keeps the fall, so the run ends only
 * once the coin has dropped out.
 */
const HUD_EVERY_TICKS = 3;

interface Props {
  run: ArcadeRun | null;
  reduced: boolean;
  onHud: (hud: FlapHud) => void;
  onEnd: (end: RunEnd) => void;
  onCue: (cue: FlapCue) => void;
  statsRef: RefObject<FrameStats>;
  /** The full-screen stage: the whole screen takes the finger, the picture sits in this band. */
  band?: FieldBand | null;
  /** A paused run holds its tick; the trace is by tick, so a pause never changes the replay. */
  paused?: boolean;
}

export function FlapField({ run, reduced, onHud, onEnd, onCue, statsRef, band = null, paused = false }: Props) {
  const surfaceRef = useRef<SurfaceHandle>(null);
  const stateRef = useRef<FlapState>(createFlapState(createRng(IDLE_SEED), { calm: false }));
  const rngRef = useRef<Rng>(createRng(IDLE_SEED));
  const configRef = useRef<ArcadeRunConfig>({ calm: false });
  const traceRef = useRef<number[]>([]);
  const pressedRef = useRef(false);
  const fxRef = useRef(createFlapFx());
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const runRef = useRef<ArcadeRun | null>(null);
  const [running, setRunning] = useState(false);

  const callbacks = useRef({ onHud, onEnd, onCue });
  callbacks.current = { onHud, onEnd, onCue };

  const hud = useCallback((state: FlapState) => {
    callbacks.current.onHud({ score: state.score, elapsedSec: state.elapsedSec, alive: !state.over && !state.dying });
  }, []);

  const driverRef = useRef<LoopDriver>({
    step() {
      const state = stateRef.current;
      const active = runRef.current;
      if (!active || state.over) return;
      const flap = pressedRef.current && !state.dying;
      pressedRef.current = false;
      if (flap) {
        traceRef.current.push(state.tick);
        if (!reducedRef.current) flapFxPress(fxRef.current, state);
        callbacks.current.onCue("flap");
      }
      stepFlap(state, flap, rngRef.current, configRef.current);
      if (state.scored) callbacks.current.onCue("score");
      if (state.crashed) {
        hud(state);
        callbacks.current.onCue("crash");
      }
      if (state.tick % HUD_EVERY_TICKS === 0) hud(state);
      if (state.over) {
        hud(state);
        setRunning(false);
        callbacks.current.onEnd({
          game: "candle-hop",
          seed: active.seed,
          calm: active.calm,
          score: state.score,
          ticks: state.tick,
          durationMs: ticksToMs(state.tick),
          trace: traceRef.current,
        });
      }
    },
    draw(view: ArcadeView, alpha: number, nowMs: number) {
      drawFlap(view, stateRef.current, alpha, nowMs, fxRef.current, reducedRef.current);
    },
  });

  useArcadeFrames(driverRef, surfaceRef, running && !paused, statsRef);

  useEffect(() => {
    if (!run) return;
    runRef.current = run;
    rngRef.current = createRng(run.seed);
    configRef.current = { calm: run.calm };
    stateRef.current = createFlapState(rngRef.current, configRef.current);
    traceRef.current = [];
    pressedRef.current = false;
    fxRef.current = createFlapFx();
    hud(stateRef.current);
    setRunning(true);
    return () => {
      runRef.current = null;
    };
  }, [run, hud]);

  // Touch-down, not release: a hop answers the finger the moment it lands.
  const press = useMemo(
    () =>
      Gesture.Manual()
        .runOnJS(true)
        .enabled(running && !paused)
        .onTouchesDown(() => {
          pressedRef.current = true;
        }),
    [running, paused],
  );

  return (
    <GestureDetector gesture={press}>
      <View style={StyleSheet.absoluteFill}>
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
