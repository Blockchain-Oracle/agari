import type { ArcadeGame } from "@agari/core/games/arcade";
import type { PostState } from "@/features/games/arcade/ArcadeOverlays";
import type { FlapCue, FlapHud } from "@/features/games/arcade/FlapCanvas";
import type { RideCue, RideHud } from "@/features/games/arcade/RideCanvas";
import type { ArcadePhase, ArcadeRun, RunEnd } from "@/features/games/arcade/run";
import { useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { ArcadeHud } from "./ArcadeHud";
import { OverOverlay, TitleOverlay } from "./ArcadeOverlays";
import { ARCADE_NATIVE } from "./copy";
import { FlapField } from "./FlapField";
import { ISLAND } from "./palette";
import { RideField } from "./RideField";
import { FRESH_STATS, type FrameStats } from "./useArcadeFrames";

/**
 * web's `.ar-screen`: the one dark island under /games — a 16:9 field with a hairline bezel and four screws,
 * the engine's picture, the HUD while a run is live, and the title or game-over plate over it. It keeps the dark
 * theme's values whatever the app wears, because its ground is part of the mechanic.
 */
interface Props {
  game: ArcadeGame;
  phase: ArcadePhase;
  run: ArcadeRun | null;
  reduced: boolean;
  hud: { score: number; combo: number };
  liveBest: number;
  best: number | null;
  end: RunEnd | null;
  post: PostState;
  onPlay: () => void;
  onRideHud: (hud: RideHud) => void;
  onFlapHud: (hud: FlapHud) => void;
  onEnd: (end: RunEnd) => void;
  onRideCue: (cue: RideCue) => void;
  onFlapCue: (cue: FlapCue) => void;
}

const statsLine = (s: FrameStats) => ` [frame ${s.frameMs.toFixed(1)} ms, js ${s.workMs.toFixed(2)} ms, ${s.targetFps} fps]`;

export function ArcadeIsland(props: Props) {
  const { game, phase, run, reduced, hud, liveBest, best, end, post, onPlay } = props;
  const statsRef = useRef<FrameStats>(FRESH_STATS);
  const { width } = useWindowDimensions();
  // web drops the pitch only on screens narrower than 360 px.
  const compact = width < 360;
  const playing = phase === "playing";
  // Dev builds carry the measured frame times on the field's label, where the simulator's accessibility tree reads them.
  const label = ARCADE_NATIVE.stageA11y[game] + (__DEV__ ? statsLine(statsRef.current) : "");

  return (
    <View style={[styles.screen, { backgroundColor: ISLAND.ground, borderColor: ISLAND.hairline }]}>
      <View style={StyleSheet.absoluteFill} accessible={playing} accessibilityLabel={label}>
        {game === "line-rider" ? (
          <RideField
            run={run}
            reduced={reduced}
            onHud={props.onRideHud}
            onEnd={props.onEnd}
            onCue={props.onRideCue}
            statsRef={statsRef}
          />
        ) : (
          <FlapField
            run={run}
            reduced={reduced}
            onHud={props.onFlapHud}
            onEnd={props.onEnd}
            onCue={props.onFlapCue}
            statsRef={statsRef}
          />
        )}
      </View>

      {[styles.tl, styles.tr, styles.bl, styles.br].map((corner, i) => (
        <View key={i} pointerEvents="none" style={[styles.screw, corner, { backgroundColor: ISLAND.screw }]} />
      ))}

      {playing ? <ArcadeHud score={hud.score} best={liveBest} combo={game === "line-rider" ? hud.combo : null} /> : null}
      {phase === "title" ? <TitleOverlay game={game} best={best} compact={compact} reduced={reduced} onPlay={onPlay} /> : null}
      {phase === "over" && end ? <OverOverlay end={end} post={post} reduced={reduced} onAgain={onPlay} /> : null}
      {__DEV__ && phase === "over" ? <View accessible accessibilityLabel={`arcade dev stats${statsLine(statsRef.current)}`} style={styles.devProbe} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { width: "100%", aspectRatio: 16 / 9, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  screw: { position: "absolute", width: 5, height: 5 },
  tl: { top: 4, left: 4 },
  tr: { top: 4, right: 4 },
  bl: { bottom: 4, left: 4 },
  br: { bottom: 4, right: 4 },
  devProbe: { position: "absolute", right: 0, bottom: 0, width: 1, height: 1 },
});
