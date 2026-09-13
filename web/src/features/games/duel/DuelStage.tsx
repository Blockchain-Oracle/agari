"use client";

import { isTerminal, type MatchState, type StakeTierId } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Bytes32 } from "@masayume/core/types";
import { useArenaMatch } from "@masayume/markets/react";
import { shortHex } from "@masayume/core/units";
import { useEffect, useState, type ReactNode } from "react";
import { useNowMs } from "@/components/data";
import { useWalletSession } from "@/lib/wallet-session";
import { useGames } from "../GamesProvider";
import { DUEL } from "./copy";
import { DuelEntry } from "./DuelEntry";
import { DuelLobby } from "./DuelLobby";
import { DuelPicking } from "./DuelPicking";
import { DuelPublicResult } from "./DuelPublicResult";
import { DuelQueue } from "./DuelQueue";
import { DuelResult } from "./DuelResult";
import { RefusalPlate } from "./DuelWaiting";
import { useArenaWrites } from "./useArenaWrites";
import { useDuelRoom } from "./useDuelRoom";
import { MATCH_AGENT_TTL_SEC } from "./useGameSession";
import { searchingNow, useRoomOccupancy, type RoomOccupancy } from "./useRoomOccupancy";
import "./duel.css";

/**
 * `/games/duel` — the match, drawn from whatever phase the reducer is in.
 *
 * There is one branch here per phase of `MatchState` and no screen state beside it. That is the whole
 * design: the room folds chain-derived messages into the reducer, and this file only chooses which
 * face of that union to draw, so a reconnect that lands on a snapshot draws the right thing without
 * anything here having remembered a step.
 *
 * The shell's `match` is published from here, because the hub has to be able to offer "resume" over
 * "start a new one" from any page under `/games` (`GamesProvider` §match).
 */
export function DuelStage({ resumeMatchId = null }: { resumeMatchId?: Bytes32 | null }) {
  const room = useDuelRoom("default", resumeMatchId);
  const { address } = useWalletSession();
  // A deep link is answered from the chain first: a seat gets the stage in resume mode, anyone else the
  // read-only result — Flicky's `play.tsx` guard, which sends a non-participant to `/game/duel/:id`.
  const named = useArenaMatch(resumeMatchId);
  const namedView = named && isOk(named) ? named.value : null;
  const you = address?.toLowerCase() ?? null;
  const spectator = resumeMatchId !== null && namedView !== null && (you === null || (namedView.match.creator !== you && namedView.match.challenger !== you));
  const { setMatch } = useGames();
  const { state, auth } = room;
  // Held here so it survives the entry being unmounted and remounted by a phase change.
  const [tierId, setTierId] = useState<StakeTierId>("free");
  // Read whether or not a wallet is connected: the gate needs it most.
  const occupancy = useRoomOccupancy();

  // The shell's copy of the match, so the rail and the hub can offer to bring a player back to it.
  useEffect(() => setMatch(state), [state, setMatch]);

  return (
    <div className="container gm-page">
      <header className="du-head">
        <span className="gm-eyebrow">{DUEL.eyebrow}</span>
        <h1 className="du-title">
          {DUEL.title}
          <span className="accent">.</span>
        </h1>
      </header>

      <div className="du-layout">
        <div>
          {spectator && resumeMatchId ? (
            <DuelPublicResult matchId={resumeMatchId} />
          ) : auth.kind !== "ready" ? (
            <Gate room={room} occupancy={occupancy} />
          ) : (
            <Match room={room} wallet={address} tierId={tierId} onTier={setTierId} occupancy={occupancy} />
          )}
          {room.error && (
            <div className="du-error" role="status">
              <p className="du-body">{room.error.message}</p>
              <p className="du-foot">{room.error.retryable ? DUEL.error.retryable : DUEL.error.terminal}</p>
              <button type="button" className="du-quiet" onClick={room.dismissError}>
                {DUEL.error.dismiss}
              </button>
            </div>
          )}
        </div>

        <aside className="du-side">
          <p className="du-intro">{DUEL.intro}</p>
          <Connection status={room.status} authed={auth.kind === "ready"} />
        </aside>
      </div>
    </div>
  );
}

/**
 * Everything before the socket: no room here, no wallet, or the key still signing the room in.
 *
 * Nothing here is a wallet prompt any more — Flicky's room takes a bare `hello`, and ours takes the
 * browser key's word until the chain names it — so the only button left is a retry after a refusal.
 * Every arm carries the room's occupancy, read with no credential at all: a player standing here is
 * deciding whether anybody is on the other side, and that is answered for free.
 */
function Gate({ room, occupancy }: { room: ReturnType<typeof useDuelRoom>; occupancy: RoomOccupancy | null }) {
  const { auth, authorize } = room;
  const here = <Occupancy occupancy={occupancy} />;

  if (auth.kind === "unavailable") {
    return (
      <div className="du-plate">
        <h2 className="du-queue-title">{DUEL.entry.unavailable}</h2>
        <p className="du-body">{auth.why}</p>
      </div>
    );
  }
  if (auth.kind === "connect") {
    return (
      <div className="du-plate">
        <h2 className="du-queue-title">{DUEL.auth.connectTitle}</h2>
        <p className="du-body">{DUEL.auth.connectBody}</p>
        {here}
      </div>
    );
  }
  if (auth.kind === "refused") {
    return (
      <div className="du-plate">
        <h2 className="du-queue-title">{DUEL.auth.openingTitle}</h2>
        <p className="du-body">{DUEL.auth.openingBody}</p>
        {here}
        <p className="du-refusal">{auth.why}</p>
        <button type="button" className="du-cta" onClick={() => void authorize()}>
          {DUEL.auth.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="du-plate">
      <div className="du-queue-head">
        <span className="du-spinner" aria-hidden />
        <h2 className="du-queue-title">{DUEL.auth.openingTitle}</h2>
      </div>
      <p className="du-body">{DUEL.auth.openingBody}</p>
      {here}
    </div>
  );
}

/** One branch per phase. Nothing here is invented: every arm draws a state the reducer is actually in. */
function Match({
  room,
  wallet,
  tierId,
  onTier,
  occupancy,
}: {
  room: ReturnType<typeof useDuelRoom>;
  wallet: string | null;
  tierId: StakeTierId;
  onTier: (tier: StakeTierId) => void;
  occupancy: RoomOccupancy | null;
}) {
  const { state } = room;
  const nowMs = useNowMs();
  const entry = <DuelEntry onFind={room.joinQueue} roomOpen={room.status === "open"} tierId={tierId} onTier={onTier} occupancy={occupancy} />;

  // The room admitted the wallet and refused the key: the seat is real and this browser cannot yet swipe for it.
  if (room.error?.code === "wrong-key" && room.error.matchId) return <Rekey matchId={room.error.matchId as Bytes32} room={room} wallet={wallet} />;

  switch (state.phase) {
    case "idle":
      return entry;

    /**
     * The entry again, with what just happened above it.
     *
     * `readiness` is where a dissolved pairing lands, and saying nothing here would put the player back
     * at "find a match" as though the last two minutes had not happened — which, before `match.dissolved`
     * existed, is what a silent re-queue did to them.
     */
    case "readiness":
      return room.dissolved ? <Dissolved dissolved={room.dissolved} entry={entry} /> : entry;

    case "queued":
      // `nowMs` ticks, so the wait counts up instead of freezing at whatever the last render saw.
      return <DuelQueue queue={room.queue} waitedSec={nowMs === 0 ? 0 : Math.max(0, Math.floor((nowMs - state.queuedAtMs) / 1_000))} onLeave={room.leaveQueue} />;

    case "matched":
    case "committed":
    case "revealed":
      return <DuelLobby state={state} wallet={wallet} dealing={room.dealing} />;

    case "picking":
      return <DuelPicking state={state} wallet={wallet} room={room} />;

    case "locked":
    case "settling":
    case "finalized":
    case "forfeited":
      return <DuelResult state={state} wallet={wallet} />;

    case "cancelled":
    case "expired":
      return <Ended body={state.phase === "expired" ? DUEL.ended.expired : room.queueDropped ? DUEL.ended.dropped : DUEL.ended.cancelled} entry={entry} />;

    case "refunded":
      return <Ended body={DUEL.ended.refunded[state.reason]} entry={entry} />;

    default:
      // Picking, locked, settling, finalized and forfeited: live on chain, not yet drawn here.
      return <Beyond state={state} />;
  }
}

/**
 * The way back into a seat from a browser whose key the entry did not name.
 *
 * The arena admits one agent per seat per match, and the room now checks a socket's key against it. So a
 * player on a second device, or one whose IndexedDB was cleared mid-duel, is not locked out: their wallet
 * names this browser's key with `authorizeAgent` — one transaction, this match only — and the room is asked
 * again. The other browser's key stops swiping the moment this lands; nothing about the pot or the picks
 * already on the book changes.
 */
function Rekey({ matchId, room, wallet }: { matchId: Bytes32; room: ReturnType<typeof useDuelRoom>; wallet: string | null }) {
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
    <div className="du-plate">
      <h2 className="du-queue-title">{words.title}</h2>
      <p className="du-body">{words.body}</p>
      <dl className="du-facts">
        <div className="du-fact">
          <dt className="du-k">{DUEL.beyond.match}</dt>
          <dd className="du-v du-mono">{shortHex(matchId, 10, 8)}</dd>
        </div>
      </dl>
      {!canSign || !game.key ? (
        <p className="du-refusal">{words.noSigner}</p>
      ) : (
        <button type="button" className="du-cta" disabled={busy !== null} onClick={name}>
          {busy === "authorize" ? words.naming : words.cta}
        </button>
      )}
      <p className="du-foot">{words.note}</p>
      {refusal && <RefusalPlate diagnosis={refusal.diagnosis} gasShort={refusal.gasShort} wallet={wallet as `0x${string}` | null} />}
    </div>
  );
}

/** The room's own count, or the honest absence of one. Never a zero standing in for a service that is down. */
function Occupancy({ occupancy }: { occupancy: RoomOccupancy | null }) {
  if (!occupancy) return null;
  if (!occupancy.reachable) return <p className="du-foot">{DUEL.auth.roomDown}</p>;
  const searching = searchingNow(occupancy);
  if (searching > 0) return <p className="du-deck">{DUEL.auth.searching(searching)}</p>;
  if (occupancy.pairing > 0) return <p className="du-deck">{DUEL.auth.inMatch(occupancy.pairing)}</p>;
  return <p className="du-foot">{DUEL.auth.nobody}</p>;
}

/** A pairing the room ended before the chain was involved: what happened, and what is being done about it. */
function Dissolved({ dissolved, entry }: { dissolved: NonNullable<ReturnType<typeof useDuelRoom>["dissolved"]>; entry: ReactNode }) {
  return (
    <>
      <div className="du-notice" role="status">
        <p className="du-body">
          {DUEL.lobby.dissolvedTitle}: {dissolved.why}.
        </p>
        <p className="du-foot">{dissolved.searchAgain ? DUEL.lobby.dissolvedAgain : DUEL.lobby.dissolvedStop}</p>
      </div>
      {entry}
    </>
  );
}

/** A match that ended without a winner. It says what happened, then offers the entry again. */
function Ended({ body, entry }: { body: string; entry: ReactNode }) {
  return (
    <>
      <p className="du-notice">{body}</p>
      {entry}
    </>
  );
}

/**
 * A match past this build's screens. It reports where the match really is and what will finish it,
 * and it invents nothing: settlement, the pot and every payout are permissionless cranks that run
 * with or without this page open.
 */
function Beyond({ state }: { state: MatchState }) {
  return (
    <div className="du-plate">
      <h2 className="du-queue-title">{DUEL.beyond.title}</h2>
      <p className="du-body">{isTerminal(state.phase) || state.phase === "forfeited" ? DUEL.beyond.done : DUEL.beyond.live}</p>
      {"matchId" in state && (
        <dl className="du-facts">
          <div className="du-fact">
            <dt className="du-k">{DUEL.beyond.match}</dt>
            <dd className="du-v du-mono">{shortHex(state.matchId, 10, 8)}</dd>
          </div>
          <div className="du-fact">
            <dt className="du-k">{DUEL.beyond.phase}</dt>
            <dd className="du-v">{state.phase}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function Connection({ status, authed }: { status: string; authed: boolean }) {
  if (!authed) return null;
  const label =
    status === "open"
      ? DUEL.status.open
      : status === "reconnecting"
        ? DUEL.status.reconnecting
        : status === "closed"
          ? DUEL.status.closed
          : DUEL.status.connecting;
  return (
    <p className={`du-conn du-conn--${status}`} role="status">
      <span className="du-conn-dot" aria-hidden />
      {label}
    </p>
  );
}
