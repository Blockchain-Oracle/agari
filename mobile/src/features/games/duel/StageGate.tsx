import type { Address, Hash32 } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { DUEL } from "@/features/games/duel/copy";
import { useArenaWrites } from "@/features/games/duel/useArenaWrites";
import type { DuelRoom, RoomStatus } from "@/features/games/duel/useDuelRoom";
import { MATCH_AGENT_TTL_SEC } from "@/features/games/duel/useGameSession";
import { searchingNow, type RoomOccupancy } from "@/features/games/duel/useRoomOccupancy";
import { Button, ConnectGate } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { RefusalPlate } from "./DuelWaiting";
import { Body, DeckLine, Facts, Foot, Plate, PlateTitle, Refusal } from "./parts";

/**
 * web's `DuelStage.tsx` Gate, Rekey, Occupancy and Connection. The gate is everything before the socket: no room,
 * no wallet, or the game key still signing the room in (no wallet prompt). Each arm carries the room's occupancy,
 * read with no credential.
 */
export function Gate({ room, occupancy }: { room: DuelRoom; occupancy: RoomOccupancy | null }) {
  const { auth, authorize } = room;
  const here = <Occupancy occupancy={occupancy} />;
  if (auth.kind === "unavailable") {
    return (
      <Plate>
        <PlateTitle>{DUEL.entry.unavailable}</PlateTitle>
        <Body>{auth.why}</Body>
      </Plate>
    );
  }
  if (auth.kind === "connect") {
    return (
      <>
        <ConnectGate why={DUEL.auth.connectBody} />
        <Plate>{here}</Plate>
      </>
    );
  }
  if (auth.kind === "refused") {
    return (
      <Plate>
        <PlateTitle>{DUEL.auth.openingTitle}</PlateTitle>
        <Body>{DUEL.auth.openingBody}</Body>
        {here}
        <Refusal>{auth.why}</Refusal>
        <Button label={DUEL.auth.retry} onPress={() => void authorize()} />
      </Plate>
    );
  }
  return (
    <Plate>
      <PlateTitle spinning>{DUEL.auth.openingTitle}</PlateTitle>
      <Body>{DUEL.auth.openingBody}</Body>
      {here}
    </Plate>
  );
}

/** The room's own count, or the honest absence of one. Never a zero standing in for a service that is down. */
export function Occupancy({ occupancy }: { occupancy: RoomOccupancy | null }) {
  if (!occupancy) return null;
  if (!occupancy.reachable) return <Foot>{DUEL.auth.roomDown}</Foot>;
  const searching = searchingNow(occupancy);
  if (searching > 0) return <DeckLine>{DUEL.auth.searching(searching)}</DeckLine>;
  if (occupancy.pairing > 0) return <DeckLine>{DUEL.auth.inMatch(occupancy.pairing)}</DeckLine>;
  return <Foot>{DUEL.auth.nobody}</Foot>;
}

/**
 * The way back into a seat from a phone whose key the entry did not name: the wallet names this phone's key with
 * `authorizeAgent` — one transaction, this match only — and the room is asked again.
 */
export function Rekey({ matchId, room, wallet }: { matchId: Hash32; room: DuelRoom; wallet: string | null }) {
  const { authorize, busy, canSign, refusal, game } = useArenaWrites();
  const words = DUEL.rekey;
  const name = () => {
    if (!game.key) return;
    void authorize(matchId, game.key, MATCH_AGENT_TTL_SEC).then((outcome) => {
      if (outcome?.status === "confirmed") {
        room.dismissError();
        room.send({ type: "resync", matchId });
      }
    });
  };
  return (
    <Plate>
      <PlateTitle>{words.title}</PlateTitle>
      <Body>{words.body}</Body>
      <Facts items={[{ k: DUEL.beyond.match, v: shortHex(matchId, 10, 8), mono: true }]} />
      {!canSign || !game.key ? (
        <Refusal>{words.noSigner}</Refusal>
      ) : (
        <Button label={busy === "authorize" ? words.naming : words.cta} loading={busy === "authorize"} disabled={busy !== null} onPress={name} />
      )}
      <Foot>{words.note}</Foot>
      {refusal ? <RefusalPlate diagnosis={refusal.diagnosis} gasShort={refusal.gasShort} wallet={wallet as Address | null} /> : null}
    </Plate>
  );
}

/** The socket's state as a small live dot, shown once the room is authorised. */
export function Connection({ status }: { status: RoomStatus }) {
  const { color } = useTheme();
  const label =
    status === "open" ? DUEL.status.open : status === "reconnecting" ? DUEL.status.reconnecting : status === "closed" ? DUEL.status.closed : DUEL.status.connecting;
  const dot = status === "open" ? color.profit : status === "closed" ? color.loss : color.warning;
  return (
    <View style={styles.conn} accessibilityRole="text" accessibilityLiveRegion="polite">
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.connText, { color: color.inkSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  conn: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  connText: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 0.6 },
});
