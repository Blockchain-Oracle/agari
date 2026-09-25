import type { ArcadeGame } from "@agari/core/games/arcade";
import type { PostState } from "@/features/games/arcade/ArcadeOverlays";
import { ARCADE } from "@/features/games/arcade/copy";
import type { FlapCue, FlapHud } from "@/features/games/arcade/FlapCanvas";
import type { RideCue, RideHud } from "@/features/games/arcade/RideCanvas";
import { localSeed, type ArcadePhase, type ArcadeRun, type RunEnd } from "@/features/games/arcade/run";
import { useArcadeScore, type PostAbility } from "@/features/games/arcade/useArcadeScore";
import { useGameKey } from "@/features/games/duel/useGameKey";
import { useRoomToken } from "@/features/games/duel/useRoomToken";
import { useWalletSession } from "@/lib/wallet-session";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Checker, Eyebrow, PAGE_PADDING } from "~/features/games/frame";
import { useGameScreen, useGames } from "~/features/games/shell";
import { FONT, useTheme } from "~/theme";
import { ArcadeBoard } from "./ArcadeBoard";
import { ArcadeFullScreen } from "./ArcadeFullScreen";
import { ArcadeIsland } from "./ArcadeIsland";
import { ArcadeNote, ArcadeReadout, CalmSwitch } from "./ArcadeNotes";
import { hopCrashSfx, hopScoreSfx, milestoneSfx, preloadArcadeSfx, regainSfx, rideCrashSfx, rideStartSfx } from "./sfx";
import { usePullRefresh } from "~/components/kit/PullRefresh";

/**
 * web's `ArcadeStage.tsx` (`/games/line-rider`, `/games/candle-hop`) — one stage, two engines, laid out as web's
 * phone column: the eyebrow and title, the CRT with its readout, then the board, the calm switch and the note.
 *
 * Phase is Pips's three: title, playing, over. A run is a seed and the calm flag — the seed from the board's GET
 * when it answered, the phone's own entropy when it did not — and what ends a run is the engine, never the player:
 * there is no quit, so every run that ends is a run that can be posted. Posting carries the duel room's token (the
 * game key's word for the wallet, no prompt); a signed-out player plays the same game and the board says "connect
 * to post". The page is web's; a live run takes the whole phone (`ArcadeFullScreen`) and hands back at game over.
 */
interface Hud {
  score: number;
  combo: number;
}

const HUD_ZERO: Hud = { score: 0, combo: 1 };

function localWhy(ability: PostAbility): PostState {
  return { kind: "local", why: ability === "signedOut" ? "signedOut" : ability === "noStore" ? "noStore" : ability === "yes" ? null : "unavailable" };
}

export function ArcadeStage({ game }: { game: ArcadeGame }) {
  const { color } = useTheme();
  const { reducedMotion, feedback } = useGames();
  const { address } = useWalletSession();
  const { auth } = useRoomToken(useGameKey());
  const { board, refresh, post, ability } = useArcadeScore(game, auth);
  const words = ARCADE.games[game];
  useGameScreen(game);

  const [phase, setPhase] = useState<ArcadePhase>("title");
  const [run, setRun] = useState<ArcadeRun | null>(null);
  const [calm, setCalm] = useState(false);
  const [hud, setHud] = useState<Hud>(HUD_ZERO);
  const [end, setEnd] = useState<RunEnd | null>(null);
  const [postState, setPostState] = useState<PostState>({ kind: "local", why: null });
  const [sessionBest, setSessionBest] = useState<number | null>(null);
  /** Gaps cleared in a row this run: the hop's "tuiing" climbs with it and it resets every run. */
  const streakRef = useRef(0);

  useEffect(() => {
    preloadArcadeSfx(game);
  }, [game]);

  // Reduced motion offers the calmer ramp; it stays a choice the player can flip either way.
  useEffect(() => {
    if (reducedMotion) setCalm(true);
  }, [reducedMotion]);

  const start = useCallback(() => {
    feedback("tap");
    if (game === "line-rider") rideStartSfx();
    streakRef.current = 0;
    setEnd(null);
    setHud(HUD_ZERO);
    setPostState({ kind: "local", why: null });
    setRun((held) => ({ id: (held?.id ?? 0) + 1, seed: board?.seed ?? localSeed(), calm }));
    setPhase("playing");
  }, [board?.seed, calm, feedback, game]);

  const onEnd = useCallback(
    (result: RunEnd) => {
      // The hop already sounded its crash at the impact; the ride's wipeout is the moment grip runs out.
      if (game === "line-rider") {
        rideCrashSfx();
        feedback("crash");
      }
      setEnd(result);
      setPhase("over");
      setSessionBest((best) => (best === null ? result.score : Math.max(best, result.score)));
      if (ability === "yes") {
        setPostState({ kind: "checking" });
        void post(result).then((outcome) => {
          setPostState(outcome);
          if (outcome.kind === "posted" && outcome.isBest) feedback("card-win");
        });
      } else {
        setPostState(localWhy(ability));
        void refresh();
      }
    },
    [ability, feedback, game, post, refresh],
  );

  const onRideHud = useCallback((h: RideHud) => setHud({ score: h.score, combo: h.multiplier }), []);
  const onFlapHud = useCallback((h: FlapHud) => setHud({ score: h.score, combo: 1 }), []);
  const onRideCue = useCallback(
    (cue: RideCue) => {
      if (cue.kind === "milestone") {
        milestoneSfx(cue.mult);
        feedback("confirm");
      } else {
        regainSfx();
        feedback("tap");
      }
    },
    [feedback],
  );
  const onFlapCue = useCallback(
    (cue: FlapCue) => {
      if (cue === "flap") feedback("tap");
      else if (cue === "score") hopScoreSfx(streakRef.current++);
      else {
        hopCrashSfx();
        feedback("crash");
      }
    },
    [feedback],
  );

  // Ending from the pause plate throws the run away: the engine never ended it, so there is nothing to post.
  const quit = useCallback(() => {
    feedback("tap");
    setRun(null);
    setHud(HUD_ZERO);
    setPhase("title");
  }, [feedback]);

  const playing = phase === "playing";
  // The run's full-screen modal belongs to this screen: leaving it (a tab, a deep link, a tapped notification) throws
  // the run away, or the modal would stay over whatever screen the app went to.
  useFocusEffect(
    useCallback(
      () => () => {
        setRun(null);
        setHud(HUD_ZERO);
        setPhase((held) => (held === "playing" ? "title" : held));
      },
      [],
    ),
  );
  const refreshControl = usePullRefresh(refresh, !playing);
  const boardBest = board?.me?.best ?? null;
  const best = sessionBest === null ? boardBest : boardBest === null ? sessionBest : Math.max(sessionBest, boardBest);
  const liveBest = Math.max(best ?? 0, hud.score);

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: color.ground }]}
      contentContainerStyle={PAGE_PADDING}
      scrollEnabled={!playing}
      refreshControl={refreshControl}
    >
      <Checker />
      <View style={styles.head}>
        <Eyebrow style={styles.eyebrow}>{ARCADE.eyebrow}</Eyebrow>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {words.title}
          <Text style={{ color: color.accent }}>.</Text>
        </Text>
      </View>

      <View style={styles.layout}>
        <View style={styles.column}>
          {/* The page's screen only ever shows the idle field: a live run plays full screen, over the page. */}
          <ArcadeIsland
            game={game}
            phase={phase}
            run={null}
            reduced={reducedMotion}
            hud={hud}
            liveBest={liveBest}
            best={best}
            end={end}
            post={postState}
            onPlay={start}
            onRideHud={onRideHud}
            onFlapHud={onFlapHud}
            onEnd={onEnd}
            onRideCue={onRideCue}
            onFlapCue={onFlapCue}
          />
          <ArcadeReadout game={game} />
        </View>

        <View style={styles.column}>
          <ArcadeBoard board={board} you={address} post={postState} ability={ability} />
          <CalmSwitch calm={calm} disabled={playing} onChange={setCalm} />
          <ArcadeNote />
        </View>
      </View>
      {playing && run ? (
        <ArcadeFullScreen
          game={game}
          run={run}
          reduced={reducedMotion}
          hud={hud}
          best={best ?? 0}
          onRideHud={onRideHud}
          onFlapHud={onFlapHud}
          onEnd={onEnd}
          onRideCue={onRideCue}
          onFlapCue={onFlapCue}
          onQuit={quit}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { marginBottom: 20 },
  eyebrow: { marginBottom: 12 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 31, letterSpacing: -1.2 },
  layout: { gap: 16 },
  column: { gap: 12 },
});
