import { isTerminal, type MatchState, type StakeTierId } from "@agari/core/games";
import { isOk } from "@agari/core/schemas";
import type { Hash32 } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { useArenaMatch } from "@agari/markets/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useNowMs } from "@/components/data/useNowMs";
import { DUEL } from "@/features/games/duel/copy";
import { useDuelRoom, type DuelRoom } from "@/features/games/duel/useDuelRoom";
import { useRoomOccupancy, type RoomOccupancy } from "@/features/games/duel/useRoomOccupancy";
import { useWalletSession } from "@/lib/wallet-session";
import { haptic, Hero } from "~/components/kit";
import { useTheme } from "~/theme";
import { useGames } from "../shell/context";
import { useStageFeel } from "../stage";
import { DuelEntry } from "./DuelEntry";
import { DuelHistory } from "./DuelHistory";
import { DuelLobby } from "./DuelLobby";
import { DuelPicking } from "./DuelPicking";
import { DuelPublicResult } from "./DuelPublicResult";
import { DuelQueue } from "./DuelQueue";
import { DuelResult } from "./DuelResult";
import { Body, Facts, Foot, Plate, PlateTitle, Quiet, Refusal } from "./parts";
import { Connection, Gate, Rekey } from "./StageGate";

/**
 * web's `DuelStage.tsx`: `/games/duel`, drawn from whatever phase the reducer is in — one branch per phase and no
 * screen state beside it, so a reconnect that lands on a snapshot draws the right thing.
 *
 * On the phone the socket must also survive the app going to the background: iOS suspends it, and web's backoff
 * could leave a returning player waiting up to fifteen seconds. So when the app comes back active with the room not
 * open, the room is remounted — a fresh socket at once, whose `hello` gets the match back from the chain's snapshot.
 */
export function DuelStage({ resumeMatchId = null }: { resumeMatchId?: Hash32 | null }) {
  const [epoch, setEpoch] = useState(0);
  return <RoomStage key={epoch} resumeMatchId={resumeMatchId} onStale={() => setEpoch((n) => n + 1)} />;
}

function RoomStage({ resumeMatchId, onStale }: { resumeMatchId: Hash32 | null; onStale: () => void }) {
  const room = useDuelRoom("default", resumeMatchId);
  const { address } = useWalletSession();
  const { setMatch } = useGames();
  const { feedback } = useStageFeel();
  const named = useArenaMatch(resumeMatchId);
  const namedView = named && isOk(named) ? named.value : null;
  const you = address ?? null;
  const spectator =
    resumeMatchId !== null && namedView !== null && (you === null || (namedView.match.creator !== you && namedView.match.challenger !== you));
  const { state, auth } = room;
  const [tierId, setTierId] = useState<StakeTierId>("free");
  const occupancy = useRoomOccupancy();
  const { color } = useTheme();
  // Pull to refresh asks the room for this match's snapshot again (web's `resync`), or reconnects a dropped room.
  const refresh = () => {
    haptic.select();
    if (room.status !== "open") onStale();
    else room.resync();
  };

  useEffect(() => setMatch(state), [state, setMatch]);

  // web plays match-found from the socket through Web Audio; the phone plays it, with its heavy haptic, on the phase.
  const lastPhase = useRef(state.phase);
  useEffect(() => {
    if (lastPhase.current === "queued" && state.phase === "matched") feedback("match-found");
    lastPhase.current = state.phase;
  }, [state.phase, feedback]);

  const statusRef = useRef(room.status);
  statusRef.current = room.status;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && statusRef.current !== "open" && statusRef.current !== "idle") onStale();
    });
    return () => sub.remove();
  }, [onStale]);

  if (state.phase === "picking" && auth.kind === "ready" && !spectator && room.error?.code !== "wrong-key") {
    return <DuelPicking state={state} wallet={you} room={room} />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={color.accent} colors={[color.accent]} />}
    >
      <Hero kicker={DUEL.eyebrow} title={`${DUEL.title}.`} />
      {auth.kind === "ready" ? <Connection status={room.status} /> : null}
      {spectator && resumeMatchId ? (
        <DuelPublicResult matchId={resumeMatchId} />
      ) : auth.kind !== "ready" ? (
        <Gate room={room} occupancy={occupancy} />
      ) : (
        <Match room={room} wallet={you} tierId={tierId} onTier={setTierId} occupancy={occupancy} />
      )}
      {room.error ? (
        <Refusal>
          <Body>{room.error.message}</Body>
          <Foot>{room.error.retryable ? DUEL.error.retryable : DUEL.error.terminal}</Foot>
          <Quiet label={DUEL.error.dismiss} onPress={room.dismissError} />
        </Refusal>
      ) : null}
      <Body>{DUEL.intro}</Body>
      {!spectator && (state.phase === "idle" || state.phase === "readiness" || isTerminal(state.phase)) ? <DuelHistory compact /> : null}
    </ScrollView>
  );
}

function Match({ room, wallet, tierId, onTier, occupancy }: {
  room: DuelRoom;
  wallet: string | null;
  tierId: StakeTierId;
  onTier: (tier: StakeTierId) => void;
  occupancy: RoomOccupancy | null;
}) {
  const { state } = room;
  const nowMs = useNowMs();
  const entry = <DuelEntry onFind={room.joinQueue} roomOpen={room.status === "open"} tierId={tierId} onTier={onTier} occupancy={occupancy} />;

  if (room.error?.code === "wrong-key" && room.error.matchId) return <Rekey matchId={room.error.matchId as Hash32} room={room} wallet={wallet} />;

  switch (state.phase) {
    case "idle":
      return entry;
    case "readiness":
      return room.dissolved ? (
        <Ended entry={entry}>
          <Body>
            {DUEL.lobby.dissolvedTitle}: {room.dissolved.why}.
          </Body>
          <Foot>{room.dissolved.searchAgain ? DUEL.lobby.dissolvedAgain : DUEL.lobby.dissolvedStop}</Foot>
        </Ended>
      ) : (
        entry
      );
    case "queued":
      return (
        <DuelQueue
          queue={room.queue}
          waitedSec={nowMs === 0 ? 0 : Math.max(0, Math.floor((nowMs - state.queuedAtMs) / 1_000))}
          onLeave={room.leaveQueue}
        />
      );
    case "matched":
    case "committed":
    case "revealed":
      return <DuelLobby state={state} wallet={wallet} dealing={room.dealing} />;
    case "locked":
    case "settling":
    case "finalized":
    case "forfeited":
      return <DuelResult state={state} wallet={wallet} />;
    case "cancelled":
    case "expired":
      return (
        <Ended entry={entry}>
          <Body>{state.phase === "expired" ? DUEL.ended.expired : room.queueDropped ? DUEL.ended.dropped : DUEL.ended.cancelled}</Body>
        </Ended>
      );
    case "refunded":
      return (
        <Ended entry={entry}>
          <Body>{DUEL.ended.refunded[state.reason]}</Body>
        </Ended>
      );
    default:
      return <Beyond state={state} />;
  }
}

/** A match that ended without a winner, or a pairing that fell through: what happened, then the entry again. */
function Ended({ children, entry }: { children: ReactNode; entry: ReactNode }) {
  return (
    <>
      <Plate tone="notice">{children}</Plate>
      {entry}
    </>
  );
}

/** A phase this screen does not draw: where the match really is, inventing nothing. */
function Beyond({ state }: { state: MatchState }) {
  return (
    <Plate>
      <PlateTitle>{DUEL.beyond.title}</PlateTitle>
      <Body>{isTerminal(state.phase) || state.phase === "forfeited" ? DUEL.beyond.done : DUEL.beyond.live}</Body>
      {"matchId" in state ? (
        <Facts
          items={[
            { k: DUEL.beyond.match, v: shortHex(state.matchId, 10, 8), mono: true },
            { k: DUEL.beyond.phase, v: state.phase },
          ]}
        />
      ) : null}
    </Plate>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingTop: 12, paddingBottom: 120, gap: 16 },
});
