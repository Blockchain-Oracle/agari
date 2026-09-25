import type { ArcadeGame } from "@agari/core/games/arcade";
import { ARCADE } from "@/features/games/arcade/copy";
import type { FlapCue, FlapHud } from "@/features/games/arcade/FlapCanvas";
import type { RideCue, RideHud } from "@/features/games/arcade/RideCanvas";
import type { ArcadeRun, RunEnd } from "@/features/games/arcade/run";
import { Pause, Smartphone, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
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

/** How long the "turn your phone" cue holds the run before the first tick. */
const CUE_MS = 1500;

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
 * A run in play takes the whole phone, sideways (the app's own addition to web's `ArcadeStage`; the page before Play
 * and after the run stays web's). The stage is turned 90° by a transform — no native orientation change — so the
 * 640×360 world's long axis runs down the phone's height: about 715 × 402 on a 402 × 874 screen. The HUD, pause and
 * hint turn with it and read upright with the phone held landscape (its top to the left); a "turn your phone" cue
 * holds the run for 1.5 s at the start. The whole stage takes the finger — tap anywhere to hop, drag anywhere to
 * steer — and gestures arrive in the stage's own turned frame, so dragging up in landscape steers up. The trace is
 * by tick, untouched by the turn, the cue or a pause. The chrome steps aside through the shell's immersive flag.
 */
export function ArcadeFullScreen(props: Props) {
  const { game, run, reduced, hud, best, onQuit } = props;
  const a = useArcadeTokens();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [paused, setPaused] = useState(false);
  const [cue, setCue] = useState(true);
  const statsRef = useRef<FrameStats>(FRESH_STATS);

  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, []);
  useEffect(() => {
    setPaused(false);
    setCue(true);
    const timer = setTimeout(() => setCue(false), CUE_MS);
    return () => clearTimeout(timer);
  }, [run]);

  // The turned stage: landscape `long × short`, centred on the screen and rotated a quarter turn clockwise, so the
  // portrait top (the notch) is its left edge and the portrait bottom its right.
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const stage = { width: long, height: short, left: (short - long) / 2, top: (long - short) / 2 };
  const inset = { left: insets.top, right: insets.bottom };
  const band = useMemo<FieldBand>(() => ({ top: 0, height: short, x0: 0 }), [short]);
  const field = { run, reduced, band, paused: paused || cue, statsRef, onEnd: props.onEnd };

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={() => setPaused(true)} supportedOrientations={["portrait"]}>
      <StatusBar hidden />
      <GestureHandlerRootView style={[styles.root, { backgroundColor: ISLAND.ground }]}>
        <View style={[styles.stage, stage]}>
        <View style={StyleSheet.absoluteFill} accessible accessibilityLabel={ARCADE_NATIVE.stageA11y[game]}>
          {game === "line-rider" ? (
            <RideField {...field} onHud={props.onRideHud} onCue={props.onRideCue} />
          ) : (
            <FlapField {...field} onHud={props.onFlapHud} onCue={props.onFlapCue} />
          )}
        </View>

        <View pointerEvents="none" style={[styles.hud, { left: inset.left + 16 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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
          style={({ pressed }) => [styles.corner, { right: inset.right + 16, borderColor: ISLAND.hairline }, pressed && styles.pressed]}
        >
          <Pause size={16} color={ISLAND.inkSoft} />
        </Pressable>

        <Text pointerEvents="none" style={[styles.hint, { color: a.ink55 }]}>
          {ARCADE_NATIVE.fullHint[game].toUpperCase()}
        </Text>

        {paused ? (
          <View style={[StyleSheet.absoluteFill, styles.pause, { backgroundColor: a.overlay }]}>
            <Pressable onPress={onQuit} accessibilityRole="button" accessibilityLabel={ARCADE_NATIVE.quit} hitSlop={12} style={[styles.corner, { right: inset.right + 16, borderColor: ISLAND.hairline }]}>
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
        </View>
        {cue ? <TurnCue /> : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

/** "Turn your phone sideways", upright in portrait: the phone glyph tips a quarter turn, then the cue fades. */
function TurnCue() {
  const a = useArcadeTokens();
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = withDelay(200, withTiming(-90, { duration: 700, easing: Easing.inOut(Easing.cubic) }));
  }, [turn]);
  const tip = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View exiting={FadeOut.duration(200)} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cue, { backgroundColor: a.overlay }]} accessibilityLiveRegion="polite">
      <Animated.View style={tip}>
        <Smartphone size={44} color={ISLAND.ink} strokeWidth={1.6} />
      </Animated.View>
      <Text style={styles.cueText}>{ARCADE_NATIVE.turn.toUpperCase()}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { position: "absolute", transform: [{ rotate: "90deg" }] },
  cue: { alignItems: "center", justifyContent: "center", gap: 18 },
  cueText: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 26, letterSpacing: 2.2, color: ISLAND.ink, textAlign: "center" },
  hud: { position: "absolute", top: 12, gap: 2 },
  k: { fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.54 },
  score: { fontFamily: PIXEL_FONT, fontSize: 44, lineHeight: 44, color: ISLAND.ink, fontVariant: ["tabular-nums"] },
  combo: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 26, letterSpacing: 2.2, color: ISLAND.accent },
  corner: { position: "absolute", top: 12, width: 40, height: 40, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.97 }] },
  hint: { position: "absolute", left: 20, right: 20, bottom: 12, textAlign: "center", fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.54 },
  pause: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  pausedTitle: { fontFamily: PIXEL_FONT, fontSize: 44, lineHeight: 44, letterSpacing: 7, color: ISLAND.ink },
  pausedNote: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 16, marginTop: 8, alignItems: "stretch" },
  quit: { alignSelf: "center", paddingVertical: 6 },
  quitText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66 },
});
