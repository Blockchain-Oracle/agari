import { FIELD_H, FIELD_W, type ArcadeGame } from "@agari/core/games/arcade";
import { ARCADE } from "@/features/games/arcade/copy";
import type { FlapCue, FlapHud } from "@/features/games/arcade/FlapCanvas";
import type { RideCue, RideHud } from "@/features/games/arcade/RideCanvas";
import type { ArcadeRun, RunEnd } from "@/features/games/arcade/run";
import { Pause, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setImmersive } from "~/components/shell/immersive";
import { Cta } from "~/features/games/frame";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { ARCADE_NATIVE } from "./copy";
import { FlapField } from "./FlapField";
import { ISLAND, useArcadeTokens } from "./palette";
import { RideField } from "./RideField";
import { FRESH_STATS, type FieldBand, type FrameStats } from "./useArcadeFrames";

/** Field units trimmed behind the player (the rider sits at 32 %, the coin at 28 %): the rest is drawn wider. */
const X0 = FIELD_W * 0.1;

interface Props {
  game: ArcadeGame;
  run: ArcadeRun;
  reduced: boolean;
  hud: { score: number; combo: number };
  best: number;
  onRideHud: (hud: RideHud) => void;
  onFlapHud: (hud: FlapHud) => void;
  onEnd: (end: RunEnd) => void;
  onRideCue: (cue: RideCue) => void;
  onFlapCue: (cue: FlapCue) => void;
  /** End the run from the pause plate: an unfinished run is discarded, never posted. */
  onQuit: () => void;
}

/**
 * A run in play takes the whole phone (the app's own addition to web's `ArcadeStage`; the page before Play and after
 * the run stays web's). The dark island fills the screen edge to edge; the field is drawn as wide as the phone, in the
 * middle band, with everything above and below it the same ground; the whole screen takes the finger — tap anywhere
 * to hop, drag anywhere to steer (the dot moves with the drag, so a thumb never covers the line). The HUD sits over
 * the top in the pixel face, a pause in the corner. The chrome steps aside through the shell's immersive flag.
 */
export function ArcadeFullScreen(props: Props) {
  const { game, run, reduced, hud, best, onQuit } = props;
  const a = useArcadeTokens();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [paused, setPaused] = useState(false);
  const statsRef = useRef<FrameStats>(FRESH_STATS);

  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, []);
  useEffect(() => setPaused(false), [run]);

  const band = useMemo<FieldBand>(() => {
    const h = (width * FIELD_H) / (FIELD_W - X0);
    return { top: Math.round((height - h) / 2), height: Math.round(h), x0: X0 };
  }, [width, height]);
  const field = { run, reduced, band, paused, statsRef, onEnd: props.onEnd };

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={() => setPaused(true)} supportedOrientations={["portrait"]}>
      <StatusBar hidden />
      <GestureHandlerRootView style={[styles.root, { backgroundColor: ISLAND.ground }]}>
        <View style={StyleSheet.absoluteFill} accessible accessibilityLabel={ARCADE_NATIVE.stageA11y[game]}>
          {game === "line-rider" ? (
            <RideField {...field} onHud={props.onRideHud} onCue={props.onRideCue} />
          ) : (
            <FlapField {...field} onHud={props.onFlapHud} onCue={props.onFlapCue} />
          )}
        </View>

        <View pointerEvents="none" style={[styles.hud, { top: insets.top + 12 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[styles.k, { color: a.ink55 }]}>{ARCADE.hud.score.toUpperCase()}</Text>
          <Text style={styles.score}>{ARCADE.fmt(hud.score)}</Text>
          <Text style={[styles.k, { color: a.ink55 }]}>
            {ARCADE.hud.best.toUpperCase()} <Text style={{ color: a.ink85 }}>{ARCADE.fmt(Math.max(best, hud.score))}</Text>
          </Text>
          {game === "line-rider" && hud.combo >= 2 ? <Text style={styles.combo}>{ARCADE.hud.combo(hud.combo)}</Text> : null}
        </View>

        <Pressable
          onPress={() => setPaused(true)}
          accessibilityRole="button"
          accessibilityLabel={ARCADE_NATIVE.pause}
          hitSlop={12}
          style={({ pressed }) => [styles.corner, { top: insets.top + 12, borderColor: ISLAND.hairline }, pressed && styles.pressed]}
        >
          <Pause size={16} color={ISLAND.inkSoft} />
        </Pressable>

        <Text pointerEvents="none" style={[styles.hint, { bottom: insets.bottom + 24, color: a.ink55 }]}>
          {ARCADE_NATIVE.fullHint[game].toUpperCase()}
        </Text>

        {paused ? (
          <View style={[StyleSheet.absoluteFill, styles.pause, { backgroundColor: a.overlay }]}>
            <Pressable onPress={onQuit} accessibilityRole="button" accessibilityLabel={ARCADE_NATIVE.quit} hitSlop={12} style={[styles.corner, { top: insets.top + 12, borderColor: ISLAND.hairline }]}>
              <X size={16} color={ISLAND.inkSoft} />
            </Pressable>
            <Text style={styles.pausedTitle}>{ARCADE_NATIVE.paused.toUpperCase()}</Text>
            <Text style={[styles.pausedNote, { color: a.ink70 }]}>{ARCADE_NATIVE.pausedNote}</Text>
            <View style={styles.actions}>
              <Cta label={ARCADE_NATIVE.resume} onPress={() => setPaused(false)} />
              <Pressable onPress={onQuit} accessibilityRole="button" hitSlop={8} style={styles.quit}>
                <Text style={[styles.quitText, { color: ISLAND.inkSoft }]}>{ARCADE_NATIVE.quit.toUpperCase()}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: { position: "absolute", left: 20, gap: 2 },
  k: { fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.54 },
  score: { fontFamily: PIXEL_FONT, fontSize: 44, lineHeight: 44, color: ISLAND.ink, fontVariant: ["tabular-nums"] },
  combo: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 26, letterSpacing: 2.2, color: ISLAND.accent },
  corner: { position: "absolute", right: 20, width: 40, height: 40, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.97 }] },
  hint: { position: "absolute", left: 20, right: 20, textAlign: "center", fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.54 },
  pause: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  pausedTitle: { fontFamily: PIXEL_FONT, fontSize: 44, lineHeight: 44, letterSpacing: 7, color: ISLAND.ink },
  pausedNote: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 16, marginTop: 8, alignItems: "stretch" },
  quit: { alignSelf: "center", paddingVertical: 6 },
  quitText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66 },
});
