"use client";

import {
  IDLE,
  matchEventsOf,
  serverMessageSchema,
  transition,
  ROOM_PROTOCOL_VERSION,
  type CardReceipt,
  type ClientMessage,
  type DuelMode,
  type MatchState,
  type RoomErrorCode,
  type ServerMessage,
  type StakeTierId,
} from "@masayume/core/games";
import type { Address } from "@masayume/core/types";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { keccak256 } from "viem";
import { useGameKey } from "./useGameKey";
import { useRoomToken, type RoomAuth } from "./useRoomToken";
import { playSfx } from "../audio";

/**
 * The duel room, as one socket and one reducer.
 *
 * Everything economic on this screen comes from `transition`, folded from messages the server built
 * out of chain logs. This hook adds no state of its own to the match: there is no local "I think I
 * picked" — the arena's own `pick.confirmed` is what moves the deck on, which is the rule doc 06
 * states as "only snapshots and events from chain and Postgres can change economic UI".
 *
 * **The seed never leaves this browser until the pairing is fixed.** A commitment goes out with the
 * queue entry, and the seed itself only after `match.found` names an opponent — so neither the
 * server nor the other player can choose theirs after seeing this one. The commitment is
 * `keccak256(seed)`, the same one line the matchmaker checks it against.
 *
 * **A dropped socket is not a lost match.** Reconnecting sends `hello` with no match id, and the
 * server answers from the arena and its projection with a whole snapshot, which the reducer treats as
 * the truth. Nothing about the previous connection is remembered on either side — which is exactly
 * why the queue is lost on a reconnect and the match is not.
 */

const SUBPROTOCOL = "masayume.room.v1";
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];
/** Closed by us, on purpose. Anything else is worth retrying. */
const CLOSED_DELIBERATELY = 1_000;
/** Long enough to read why a pairing fell through, short enough that the search feels continuous. */
const RESEARCH_MS = 2_500;

export type RoomStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

export interface DuelRoomError {
  code: RoomErrorCode;
  message: string;
  retryable: boolean;
  about: string | null;
  /** The match a refusal names, when it names one — `wrong-key` carries the seat to re-key. */
  matchId: string | null;
}

export interface QueueView {
  waitingCount: number;
  bandNow: number;
  waitedMs: number;
  /**
   * A number is a countdown; `null` is "further out than the projection looked"; **absent** is "not
   * known yet". Three different answers, kept apart all the way to the screen — rendering absent as
   * null would tell someone whose deck is one tick away that there is none coming.
   */
  nextDeckInSec: number | null | undefined;
}

/**
 * What a paired-but-undealt match is waiting on, and until when.
 *
 * Two waits sit between "opponent found" and a playable deck and a spinner cannot tell them apart: the
 * seed ceremony, which is two browsers and takes a second, and the venue's supply, which can be minutes
 * because Windows roll on aligned boundaries. This is what lets the lobby say which one and how long —
 * the room measured ninety seconds of "sealing the deck…" with nothing on screen to explain it.
 */
export interface DealingView {
  matchId: string;
  seedsIn: number;
  givesUpAtMs: number;
  /** The server's own clock at the time, so a browser with a skewed one still counts down correctly. */
  serverTimeMs: number;
  /** The queue's three-valued supply fact, unchanged: a number, a real null, or absent. */
  nextDeckInSec: number | null | undefined;
  /** When this browser received it, so the countdown runs on elapsed time rather than on ticks. */
  atMs: number;
}

/** A pairing the room has ended before anything reached the chain. */
export interface DissolvedView {
  matchId: string;
  why: string;
  /** True when nobody was at fault; the hook re-searches on its own with a fresh seed. */
  searchAgain: boolean;
}

/** "Your opponent is on this card" — advisory, and deliberately without a side (`protocol.ts`). */
export interface OpponentPending {
  cardIndex: number;
  atMs: number;
}

export interface PresenceRow {
  wallet: Address;
  online: boolean;
  lastSeenMs: number;
}

export interface DuelRoom {
  auth: RoomAuth;
  authorize: () => Promise<void>;
  status: RoomStatus;
  state: MatchState;
  queue: QueueView | null;
  presence: readonly PresenceRow[];
  /** The opponent's last advisory swipe. Never carries a side; the chain publishes that. */
  opponentPending: OpponentPending | null;
  /** What the pairing is waiting on, while it is waiting. Null once a deck exists or the match ends. */
  dealing: DealingView | null;
  /** The last pairing the room ended. Cleared by the next search. */
  dissolved: DissolvedView | null;
  error: DuelRoomError | null;
  joinQueue: (mode: DuelMode, tier: StakeTierId) => void;
  leaveQueue: () => void;
  resync: () => void;
  /** True when a dropped socket took this browser out of the queue. Cleared by the next search. */
  queueDropped: boolean;
  dismissError: () => void;
  /** The socket, for the slices that send more than the queue does. Silently ignored when closed. */
  send: (message: ClientMessage) => void;
  /**
   * A pick this browser just confirmed, folded in from its own receipt rather than waited for from the
   * projector — the same `pickConfirmed` the room will send seconds later, applied by `pickKey`, so the
   * second arrival replaces the first instead of stacking.
   */
  recordPick: (receipt: CardReceipt) => void;
}

function freshSeed(): `0x${string}` {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * `resumeMatchId` is the match a deep link names (`/games/duel/[matchId]`): the hello asks for that
 * match's snapshot instead of the queue's. Without one the server asks its own projection which match
 * this wallet is in, which is a better answer than anything this browser could remember.
 */
export function useDuelRoom(region = "default", resumeMatchId: string | null = null): DuelRoom {
  const { auth, authorize } = useRoomToken(useGameKey());
  const [state, dispatch] = useReducer(transition, IDLE);
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [queue, setQueue] = useState<QueueView | null>(null);
  const [presence, setPresence] = useState<readonly PresenceRow[]>([]);
  const [opponentPending, setOpponentPending] = useState<OpponentPending | null>(null);
  const [error, setError] = useState<DuelRoomError | null>(null);
  const [queueDropped, setQueueDropped] = useState(false);
  const [dealing, setDealing] = useState<DealingView | null>(null);
  const [dissolved, setDissolved] = useState<DissolvedView | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  /** This socket's own wallet, lowercased — the room's snapshot names it, and so does the token. */
  const walletRef = useRef<string | null>(null);
  /** The reducer's current phase, readable from the socket's own callbacks. */
  const phaseRef = useRef(state.phase);
  const seedRef = useRef<`0x${string}` | null>(null);
  /** The last search this browser asked for, so a dissolve can be answered with the same one. */
  const entryRef = useRef<{ mode: DuelMode; tier: StakeTierId } | null>(null);
  const attemptRef = useRef(0);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set while this component is tearing the socket down, so its `close` does not schedule a retry. */
  const closingRef = useRef(false);

  phaseRef.current = state.phase;

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  const onMessage = useCallback(
    (raw: unknown) => {
      const parsed = serverMessageSchema.safeParse(raw);
      // A frame this client cannot read is the server's problem, not the player's: drop it rather
      // than tearing down a live match over a field added on the other side.
      if (!parsed.success) return;
      const message: ServerMessage = parsed.data;

      switch (message.type) {
        case "queue.update":
          setQueue({
            waitingCount: message.waitingCount,
            bandNow: message.bandNow,
            waitedMs: message.waitedMs,
            // Read off the key's presence, not off the value — `null` and absent mean different things.
            nextDeckInSec: "nextDeckInSec" in message ? message.nextDeckInSec : undefined,
          });
          break;
        case "presence":
          setPresence(message.players);
          break;
        case "deck.committed":
          // The wait this described is over; leaving it up would count down to a deadline that passed.
          setDealing(null);
          break;
        case "pick.pending":
          // Relayed to both seats; a client's own swipe is not news to it.
          if (message.player.toLowerCase() !== walletRef.current) setOpponentPending({ cardIndex: message.cardIndex, atMs: Date.now() });
          break;
        case "error":
          setError({ code: message.code, message: message.message, retryable: message.retryable, about: message.about ?? null, matchId: message.matchId ?? null });
          break;
        case "match.found":
          // Flicky's cue, before the screen swaps: the sound is how a player looking away learns.
          playSfx("match-found");
          // The other half of the ceremony, sent the moment a pairing exists and not one message before.
          if (seedRef.current) send({ type: "seed.reveal", matchId: message.room.matchId, seed: seedRef.current });
          setDissolved(null);
          break;
        case "match.dealing":
          setDealing({
            matchId: message.matchId,
            seedsIn: message.seedsIn,
            givesUpAtMs: message.givesUpAtMs,
            serverTimeMs: message.serverTimeMs,
            nextDeckInSec: "nextDeckInSec" in message ? message.nextDeckInSec : undefined,
            atMs: Date.now(),
          });
          break;
        case "match.dissolved":
          // The reducer leaves `matched` on the event below; this is only what to say about it.
          setDealing(null);
          setDissolved({ matchId: message.matchId, why: message.why, searchAgain: message.searchAgain });
          break;
        default:
          break;
      }

      for (const event of matchEventsOf(message)) dispatch(event);
    },
    [send],
  );

  /** Opens a socket for the current token; every close that we did not ask for schedules a retry. */
  useEffect(() => {
    if (auth.kind !== "ready") {
      setStatus("idle");
      return;
    }

    let disposed = false;
    closingRef.current = false;

    const open = () => {
      if (disposed) return;
      setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");
      // Both protocols are offered: the room answers with its own, and a client that offered only the
      // token would be handed a subprotocol it never asked for and fail the handshake itself.
      const socket = new WebSocket(auth.url, [auth.token, SUBPROTOCOL]);
      socketRef.current = socket;

      walletRef.current = auth.wallet.toLowerCase();

      socket.onopen = () => {
        attemptRef.current = 0;
        setStatus("open");
        setError(null);
        send({ type: "hello", protocolVersion: ROOM_PROTOCOL_VERSION, ...(resumeMatchId ? { resumeMatchId } : {}) });
      };

      socket.onmessage = (event) => {
        try {
          onMessage(JSON.parse(String(event.data)));
        } catch {
          // Not JSON. The room only ever sends JSON text, so this is a proxy, not the room.
        }
      };

      socket.onclose = (event) => {
        socketRef.current = null;
        /**
         * A queue entry does not survive a socket. The server drops it the moment the connection
         * goes (`announceDeparture` calls the matchmaker's `leave`), so a client that kept showing
         * its spinner would be waiting on a queue it is no longer in — which is what the room log
         * showed a browser doing. A match is different and is deliberately NOT cleared here: it
         * lives on chain, and the reconnect's snapshot restores it.
         */
        if (phaseRef.current === "queued") {
          dispatch({ kind: "leaveQueue" });
          setQueue(null);
          setQueueDropped(true);
        }
        if (disposed || closingRef.current || event.code === CLOSED_DELIBERATELY) {
          setStatus("closed");
          return;
        }
        const wait = BACKOFF_MS[Math.min(attemptRef.current, BACKOFF_MS.length - 1)] ?? 15_000;
        attemptRef.current += 1;
        setStatus("reconnecting");
        retryRef.current = setTimeout(open, wait);
      };

      // `onerror` carries nothing a browser is allowed to read; `onclose` follows it and does the work.
      socket.onerror = () => undefined;
    };

    open();

    return () => {
      disposed = true;
      closingRef.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      socketRef.current?.close(CLOSED_DELIBERATELY, "leaving");
      socketRef.current = null;
    };
  }, [auth, onMessage, send, resumeMatchId]);

  /**
   * A search, and always a **fresh** seed.
   *
   * The seed is never reused across pairings, including the one this browser already revealed to a
   * pairing that fell through: a server that has seen a seed must not be able to pair against it again
   * before the next reveal. The room used to re-queue a player itself, carrying that same commitment
   * forward, which quietly turned the commit-reveal into neither.
   */
  const joinQueue = useCallback(
    (mode: DuelMode, tier: StakeTierId) => {
      const seed = freshSeed();
      seedRef.current = seed;
      entryRef.current = { mode, tier };
      const clientSeedCommitment = keccak256(seed);
      setError(null);
      setQueueDropped(false);
      setDissolved(null);
      setDealing(null);
      dispatch({ kind: "open", mode, tier });
      dispatch({ kind: "queue", nowMs: Date.now(), clientSeedCommitment });
      send({ type: "queue.join", mode, tier, region, clientSeedCommitment });
    },
    [region, send],
  );

  const leaveQueue = useCallback(() => {
    send({ type: "queue.leave" });
    dispatch({ kind: "leaveQueue" });
    entryRef.current = null;
    setQueue(null);
    setDissolved(null);
    setDealing(null);
  }, [send]);

  /**
   * A pairing that fell through through nobody's fault puts this browser straight back in the queue.
   *
   * It is the client that does it, and that is the point: the room announcing a dissolve and the browser
   * deciding what to do about it are one round trip, where the room silently re-queueing was a state the
   * two disagreed about. The short delay is so the reason is readable rather than a flash, and the search
   * is only sent over a socket that is actually open — a local `queued` the server never heard is the
   * spinner-on-nothing this whole slice exists to remove.
   */
  useEffect(() => {
    const entry = entryRef.current;
    if (!dissolved?.searchAgain || !entry || status !== "open") return;
    const timer = setTimeout(() => joinQueue(entry.mode, entry.tier), RESEARCH_MS);
    return () => clearTimeout(timer);
  }, [dissolved, status, joinQueue]);

  const resync = useCallback(() => {
    if ("matchId" in state) send({ type: "resync", matchId: state.matchId });
  }, [send, state]);

  const recordPick = useCallback((receipt: CardReceipt) => dispatch({ kind: "pickConfirmed", receipt }), []);

  return {
    auth,
    authorize,
    recordPick,
    status,
    state,
    queue,
    presence,
    opponentPending,
    dealing,
    dissolved,
    error,
    joinQueue,
    leaveQueue,
    resync,
    queueDropped,
    dismissError: useCallback(() => setError(null), []),
    send,
  };
}
