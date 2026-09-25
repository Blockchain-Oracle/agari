import type { MatchState } from "@agari/core/games";
import { shortHex } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { DUEL } from "@/features/games/duel/copy";
import type { DealingView } from "@/features/games/duel/useDuelRoom";
import { FONT } from "~/theme";
import { DealingPlate } from "./DuelWaiting";
import { OnChain } from "./OnChain";
import { Body, Facts, Plate, PlateTitle, Seat, useDuelTokens } from "./parts";

/**
 * web's `DuelLobby.tsx` (`.du-lobby`): between the pairing and the first swipe — the two seats with "vs" between them,
 * which side of the match this seat is, then the stage's own plate: what is happening, the room's dealing clock, the
 * two on-chain entries, and the sealed deck's commitment — the receipt that the cards were fixed before either side
 * saw them.
 */
export function DuelLobby({ state, wallet, dealing }: { state: Extract<MatchState, { matchId: string }>; wallet: string | null; dealing: DealingView | null }) {
  const { color } = useDuelTokens();
  const isCreator = wallet !== null && state.players.creator === wallet;
  const opponent = isCreator ? state.players.challenger : state.players.creator;
  const stage =
    state.phase === "matched"
      ? { title: DUEL.lobby.committing, body: DUEL.lobby.committingBody }
      : state.phase === "committed"
        ? { title: DUEL.lobby.committed, body: DUEL.lobby.committedBody }
        : { title: DUEL.lobby.revealing, body: DUEL.lobby.waitingPot };

  return (
    <Plate>
      <View style={styles.seats} accessibilityLabel={DUEL.lobby.matched}>
        <Seat label={DUEL.lobby.you} address={wallet} />
        <Text style={[styles.versus, { color: color.inkMuted }]}>vs</Text>
        <Seat label={DUEL.lobby.opponent} address={opponent} />
      </View>
      <Text style={[styles.note, { color: color.inkMuted }]}>{isCreator ? DUEL.lobby.seatCreator : DUEL.lobby.seatChallenger}</Text>

      <Plate>
        <PlateTitle spinning>{stage.title}</PlateTitle>
        <Body>{stage.body}</Body>
        {state.phase === "matched" && dealing?.matchId === state.matchId ? <DealingPlate dealing={dealing} /> : null}
        {state.phase === "committed" ? <OnChain state={state} isCreator={isCreator} wallet={wallet} /> : null}
        {"commitment" in state ? (
          <Facts
            items={[
              { k: DUEL.lobby.commitment, v: shortHex(state.commitment.hash, 10, 8) },
              { k: DUEL.entry.tier, v: DUEL.lobby.cards(state.commitment.size) },
            ]}
          />
        ) : null}
      </Plate>
    </Plate>
  );
}

const styles = StyleSheet.create({
  seats: { flexDirection: "row", alignItems: "center", gap: 14 },
  versus: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1 },
  note: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
});
