import type { ArcadeGame } from "@agari/core/games/arcade";
import type { PostState } from "@/features/games/arcade/ArcadeOverlays";
import type { FlapCue, FlapHud } from "@/features/games/arcade/FlapCanvas";
import type { RideCue, RideHud } from "@/features/games/arcade/RideCanvas";
import type { ArcadePhase, ArcadeRun, RunEnd } from "@/features/games/arcade/run";
import { useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useTheme } from "~/theme";
import { ArcadeHud } from "./ArcadeHud";
import { OverOverlay, TitleOverlay } from "./ArcadeOverlays";
import { ARCADE_NATIVE } from "./copy";
import { CrtGlass, CrtGround } from "./Crt";
import { FlapField } from "./FlapField";
import { ISLAND, useArcadeTokens } from "./palette";
import { RideField } from "./RideField";
import { FRESH_STATS, type FrameStats } from "./useArcadeFrames";

/**
 * web's `.ar-screen.crt-screen`: the one dark island under /games — a 16:9 CRT with pillow corners, the theme's
 * hairline bezel and four screws, the engine's picture, the HUD while a run is live, and the title or game-over
 * plate over it. Its ground and ink stay the dark theme's whatever the app wears: they are part of the mechanic.
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
const CORNERS = [{ top: 4, left: 4 }, { top: 4, right: 4 }, { bottom: 4, left: 4 }, { bottom: 4, right: 4 }] as const;

export function ArcadeIsland(props: Props) {
  const { game, phase, run, reduced, hud, liveBest, best, end, post, onPlay } = props;
  const { color } = useTheme();
  const a = useArcadeTokens();
  const statsRef = useRef<FrameStats>(FRESH_STATS);
  const { width } = useWindowDimensions();
  // web drops the pitch only on screens narrower than 360 px.
  const compact = width < 360;
  const playing = phase === "playing";
  // Dev builds carry the measured frame times on the field's label, where the simulator's accessibility tree reads them.
  const label = ARCADE_NATIVE.stageA11y[game] + (__DEV__ ? statsLine(statsRef.current) : "");

  return (
    <View style={[styles.screen, { backgroundColor: ISLAND.ground, borderColor: color.hairline }]}>
      <CrtGround />
      <View style={StyleSheet.absoluteFill} accessible={playing} accessibilityLabel={label}>
        {game === "line-rider" ? (
          <RideField run={run} reduced={reduced} onHud={props.onRideHud} onEnd={props.onEnd} onCue={props.onRideCue} statsRef={statsRef} />
        ) : (
          <FlapField run={run} reduced={reduced} onHud={props.onFlapHud} onEnd={props.onEnd} onCue={props.onFlapCue} statsRef={statsRef} />
        )}
      </View>
      <CrtGlass reduced={reduced} />

      {CORNERS.map((corner, i) => (
        <View key={i} pointerEvents="none" style={[styles.screw, corner, { backgroundColor: a.screw }]} />
      ))}

      {playing ? <ArcadeHud score={hud.score} best={liveBest} combo={game === "line-rider" ? hud.combo : null} /> : null}
      {phase === "title" ? <TitleOverlay game={game} best={best} compact={compact} reduced={reduced} onPlay={onPlay} /> : null}
      {phase === "over" && end ? <OverOverlay end={end} post={post} reduced={reduced} onAgain={onPlay} /> : null}
      {__DEV__ && phase === "over" ? <View accessible accessibilityLabel={`arcade dev stats${statsLine(statsRef.current)}`} style={styles.devProbe} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // web's pillow corner is 22 px / 14 px (elliptical); React Native draws circular corners, so 16.
  screen: { width: "100%", aspectRatio: 16 / 9, borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  screw: { position: "absolute", width: 6, height: 6, zIndex: 4 },
  devProbe: { position: "absolute", right: 0, bottom: 0, width: 1, height: 1 },
});
