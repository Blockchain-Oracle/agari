import type { MatchState } from "@agari/core/games";
import { shortHex } from "@agari/core/units";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { DUEL } from "@/features/games/duel/copy";
import type { DealingView } from "@/features/games/duel/useDuelRoom";
import { FONT, useTheme } from "~/theme";
import { useStageFeel } from "../stage";
import { DealingPlate } from "./DuelWaiting";
import { OnChain } from "./OnChain";
import { Avatar, Body, Facts, Foot, Key, Plate, PlateTitle } from "./parts";

/**
 * web's `DuelLobby.tsx`: between the pairing and the first swipe — an opponent, a sealed deck, the deck opening.
 * The commitment hash is on screen because it is the thing a player can check: the cards were fixed before either
 * side saw them.
 */
export function DuelLobby({ state, wallet, dealing }: { state: Extract<MatchState, { matchId: string }>; wallet: string | null; dealing: DealingView | null }) {
  const isCreator = wallet !== null && state.players.creator === wallet;
  const opponent = isCreator ? state.players.challenger : state.players.creator;
  const stage =
    state.phase === "matched"
      ? { title: DUEL.lobby.committing, body: DUEL.lobby.committingBody }
      : state.phase === "committed"
        ? { title: DUEL.lobby.committed, body: DUEL.lobby.committedBody }
        : { title: DUEL.lobby.revealing, body: DUEL.lobby.waitingPot };

  return (
    <>
      <Versus you={wallet} opponent={opponent} note={isCreator ? DUEL.lobby.seatCreator : DUEL.lobby.seatChallenger} />
      <Plate>
        <PlateTitle spinning={state.phase !== "committed"}>{stage.title}</PlateTitle>
        <Body>{stage.body}</Body>
        {state.phase === "matched" && dealing?.matchId === state.matchId ? <DealingPlate dealing={dealing} /> : null}
        {state.phase === "committed" ? <OnChain state={state} isCreator={isCreator} wallet={wallet} /> : null}
        {"commitment" in state ? (
          <Facts
            items={[
              { k: DUEL.lobby.commitment, v: shortHex(state.commitment.hash, 10, 8), mono: true },
              { k: DUEL.entry.tier, v: DUEL.lobby.cards(state.commitment.size) },
            ]}
          />
        ) : null}
      </Plate>
    </>
  );
}

// 21st: 7ovr/comparison-2 — two sides facing each other across a divider, as the duel's seats.

/** The pairing as a VS card: two seats in their address hues, slamming in from either side when the match is found. */
export function Versus({ you, opponent, note }: { you: string | null; opponent: string | null; note?: string }) {
  const { color } = useTheme();
  const { reducedMotion } = useStageFeel();
  const slam = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!reducedMotion) slam.value = withSpring(1, { stiffness: 220, damping: 18 });
  }, [reducedMotion, slam]);
  const left = useAnimatedStyle(() => ({ opacity: slam.value, transform: [{ translateX: -40 * (1 - slam.value) }] }));
  const right = useAnimatedStyle(() => ({ opacity: slam.value, transform: [{ translateX: 40 * (1 - slam.value) }] }));
  const mid = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + 0.4 * slam.value }] }));
  return (
    <View style={[styles.versus, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityRole="summary" accessibilityLabel={DUEL.lobby.matched}>
      <Key>{DUEL.lobby.matched}</Key>
      <View style={styles.row}>
        <Animated.View style={[styles.side, left]}>
          <Avatar address={you} size={56} />
          <Key>{DUEL.lobby.you}</Key>
          <Text style={[styles.addr, { color: color.ink }]}>{you ? shortHex(you, 4, 4) : "—"}</Text>
        </Animated.View>
        <Animated.View style={[styles.vsDisc, { borderColor: color.accent, backgroundColor: color.accentWash }, mid]}>
          <Text style={[styles.vs, { color: color.accent }]}>VS</Text>
        </Animated.View>
        <Animated.View style={[styles.side, right]}>
          <Avatar address={opponent} size={56} />
          <Key>{DUEL.lobby.opponent}</Key>
          <Text style={[styles.addr, { color: color.ink }]}>{opponent ? shortHex(opponent, 4, 4) : "—"}</Text>
        </Animated.View>
      </View>
      {note ? <Foot>{note}</Foot> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  versus: { alignItems: "center", gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch" },
  side: { flex: 1, alignItems: "center", gap: 6 },
  addr: { fontFamily: FONT.data, fontSize: 12 },
  vsDisc: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  vs: { fontFamily: FONT.headingHeavy, fontSize: 17, letterSpacing: 1 },
});
