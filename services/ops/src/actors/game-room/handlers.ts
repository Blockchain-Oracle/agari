import {
  encodeMatchState,
  roomError,
  roomRef,
  sanitizeChat,
  ROOM_PROTOCOL_VERSION,
  type ClientMessage,
  type MatchState,
  type ServerMessage,
} from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import { isBytes32, type Address, type Bytes32 } from "@masayume/core/types";
import { marketsProvider } from "@masayume/markets";
import { readArenaAgent } from "@masayume/markets/games";
import type { PendingMatch } from "../matchmaker/pending";
import type { RoomConnection, RoomHub } from "./hub";
import { buildMatchSnapshot } from "./snapshot";

/**
 * What the room does with one validated message.
 *
 * Two invariants hold across every branch. A connection is answered only after `hello`, so a client
 * cannot skip the version handshake by sending something else first. And joining a match's room requires
 * being one of its two players, checked against the arena's own record rather than against anything the
 * client said — there is no spectator seat, so a wallet that is not in the match is refused rather than
 * given a read-only view of somebody else's picks.
 *
 * The wallet a token claims is the browser key's word until the chain says otherwise — Flicky's `hello`
 * — so the seat check has a second half: once the arena names an agent for `(match, wallet)`, only a
 * socket holding that key is admitted to the seat's room. A key the entry never named is refused with
 * `wrong-key` and the match it is about, which is what the browser needs to offer a re-key.
 */

/** Pairing and the queue, when a matchmaker is running. Absent, the queue is honestly unavailable. */
export interface Matchmaker {
  join(connection: RoomConnection, request: Extract<ClientMessage, { type: "queue.join" }>): Promise<void>;
  leave(connection: RoomConnection): void;
  /** The second half of the queue's commitment, checked against the hash the player queued with. */
  revealSeed(connection: RoomConnection, message: Extract<ClientMessage, { type: "seed.reveal" }>): Promise<void>;
  /** A sealed deck this wallet is in that the arena has not been told about yet — see `pending.ts`. */
  pendingFor(wallet: Address): PendingMatch | null;
  /** Called when the chain turns out to hold the match after all, so the room stops waiting for it. */
  releasePending(matchId: string): void;
  /** Who is waiting, per queue. Read without a wallet, so a lobby can show it before anyone signs. */
  occupancy(): RoomOccupancy;
}

export interface RoomOccupancy {
  queues: readonly { key: string; mode: string; tier: string; waiting: number }[];
  /** Pairs past the queue and not yet on chain: sealing a deck, or waiting on a signature. */
  pairing: number;
  nextDeckInSec?: number | null;
}

/** Where a fresh browser learns which match it is already in, without being told by the browser. */
export interface MatchDirectory {
  activeMatchFor(wallet: Address): Promise<Bytes32 | null>;
}

export interface RoomContext {
  hub: RoomHub;
  chainId: number;
  arena: Address;
  log: (why: string) => void;
  matchmaker: Matchmaker | null;
  directory: MatchDirectory | null;
}

const IDLE_SNAPSHOT = { phase: "idle" } as const;

function playersOf(state: MatchState): readonly Address[] {
  if (!("players" in state)) return [];
  const { creator, challenger } = state.players;
  return challenger ? [creator, challenger] : [creator];
}

/** A match id the arena could actually hold. Checked here so a malformed one is a refusal, not an RPC error. */
function asMatchId(value: string): Bytes32 | null {
  const lower = value.toLowerCase();
  return isBytes32(lower) ? lower : null;
}

/**
 * The reconnect path, whole: read the match, check the wallet belongs in it, join its room, send one
 * snapshot, then let the deltas resume. Nothing about the previous connection is consulted.
 */
async function sendSnapshot(ctx: RoomContext, connection: RoomConnection, matchId: Bytes32 | null, about: ClientMessage["type"]): Promise<void> {
  const serverTimeMs = marketsProvider.nowMs();
  if (!matchId) {
    /**
     * Before the chain, the room is the only record there is.
     *
     * A deck sealed and not yet created exists in Postgres and in this process and nowhere else, so the
     * projection — which is the reconnect path's first question — answers "nothing". A browser that
     * reloaded in that window used to land back at the entry with its match gone, which is precisely
     * what "I refresh and it takes me back" was.
     */
    const pending = ctx.matchmaker?.pendingFor(connection.wallet) ?? null;
    if (pending) return sendPending(ctx, connection, pending, serverTimeMs);
    ctx.hub.send(connection, { type: "snapshot", serverTimeMs, wallet: connection.wallet, room: null, state: IDLE_SNAPSHOT });
    return;
  }

  const built = await buildMatchSnapshot(matchId, ctx.chainId);
  if (!built.ok) {
    ctx.hub.send(connection, roomError(built.code, built.why, about));
    return;
  }
  // The arena holds it, so the pre-chain record has done its job and must not outlive it.
  ctx.matchmaker?.releasePending(matchId);
  if (built.warning) ctx.log(built.warning);

  const players = playersOf(built.state);
  if (!players.some((player) => player === connection.wallet)) {
    ctx.hub.send(connection, roomError("forbidden", "this match is not yours", about));
    return;
  }
  if (!(await keyIsTheSeats(connection, matchId, serverTimeMs))) {
    ctx.hub.send(connection, roomError("wrong-key", "this seat named another browser's key", about, matchId));
    return;
  }

  const ref = roomRef(ctx.chainId, ctx.arena, matchId);
  ctx.hub.join(connection, ref, players);
  ctx.hub.send(connection, { type: "snapshot", serverTimeMs, wallet: connection.wallet, room: ref, state: encodeMatchState(built.state) });
  const presence = ctx.hub.presenceOf(ref.key);
  if (presence) ctx.hub.broadcast(ref.key, presence);
}

/**
 * True unless the arena has named a live agent for this seat that is not this connection's key. No agent
 * yet — before the entry, or a seat that entered without one — is the reference's trust in the claim; an
 * unreadable arena is not a refusal either, because a node blinking must not lock a player out mid-duel.
 */
async function keyIsTheSeats(connection: RoomConnection, matchId: Bytes32, nowMs: number): Promise<boolean> {
  const named = await readArenaAgent(matchId, connection.wallet);
  if (!isOk(named) || !named.value) return true;
  if (named.value.expiresAtSec <= Math.floor(nowMs / 1_000)) return true;
  return named.value.agent === connection.key;
}

/** A committed deck the arena has not been told about, as the `committed` state it already is. */
function sendPending(ctx: RoomContext, connection: RoomConnection, pending: PendingMatch, serverTimeMs: number): void {
  const ref = roomRef(ctx.chainId, ctx.arena, pending.matchId);
  const players = [pending.players.creator, pending.players.challenger].filter((w): w is Address => Boolean(w));
  ctx.hub.join(connection, ref, players);
  ctx.hub.send(connection, {
    type: "snapshot",
    serverTimeMs,
    wallet: connection.wallet,
    room: ref,
    state: encodeMatchState({
      phase: "committed",
      matchId: pending.matchId,
      players: pending.players,
      mode: pending.mode,
      tier: pending.tier,
      commitment: pending.commitment,
    }),
  });
  const presence = ctx.hub.presenceOf(ref.key);
  if (presence) ctx.hub.broadcast(ref.key, presence);
}

/** The room a message claims, if this connection is really in it. */
function roomFor(connection: RoomConnection, matchId: string): string | null {
  return connection.room && connection.room.matchId === matchId.toLowerCase() ? connection.room.key : null;
}

function relay(ctx: RoomContext, connection: RoomConnection, matchId: string, message: ServerMessage, about: ClientMessage["type"]): void {
  const key = roomFor(connection, matchId);
  if (!key) {
    ctx.hub.send(connection, roomError("forbidden", "you are not in that room", about));
    return;
  }
  ctx.hub.broadcast(key, message);
}

export async function handleMessage(ctx: RoomContext, connection: RoomConnection, message: ClientMessage): Promise<void> {
  if (message.type !== "hello" && !connection.greeted) {
    ctx.hub.send(connection, roomError("bad-protocol", "say hello first", message.type));
    return;
  }

  switch (message.type) {
    case "hello": {
      if (message.protocolVersion !== ROOM_PROTOCOL_VERSION) {
        ctx.hub.send(connection, roomError("bad-protocol", `this room speaks protocol ${ROOM_PROTOCOL_VERSION}`, "hello"));
        connection.socket.close();
        return;
      }
      connection.greeted = true;
      const asked = message.resumeMatchId ?? null;
      const resume = asked ? asMatchId(asked) : ((await ctx.directory?.activeMatchFor(connection.wallet)) ?? null);
      if (asked && !resume) {
        ctx.hub.send(connection, roomError("bad-message", "that is not a match id", "hello"));
        return;
      }
      await sendSnapshot(ctx, connection, resume, "hello");
      return;
    }

    case "resync": {
      const matchId = asMatchId(message.matchId);
      if (!matchId) {
        ctx.hub.send(connection, roomError("bad-message", "that is not a match id", "resync"));
        return;
      }
      await sendSnapshot(ctx, connection, matchId, "resync");
      return;
    }

    case "queue.join": {
      if (!ctx.matchmaker) {
        ctx.hub.send(connection, roomError("queue-unavailable", "matchmaking is not running on this room", "queue.join"));
        return;
      }
      await ctx.matchmaker.join(connection, message);
      return;
    }

    case "queue.leave":
      ctx.matchmaker?.leave(connection);
      return;

    case "seed.reveal": {
      if (!ctx.matchmaker) {
        ctx.hub.send(connection, roomError("queue-unavailable", "matchmaking is not running on this room", "seed.reveal"));
        return;
      }
      await ctx.matchmaker.revealSeed(connection, message);
      return;
    }

    /** Advisory only, and deliberately without the side: the opponent learns *that* you are deciding. */
    case "pick.pending":
      relay(ctx, connection, message.matchId, { type: "pick.pending", matchId: message.matchId, player: connection.wallet, cardIndex: message.cardIndex }, "pick.pending");
      return;

    case "chat": {
      const body = sanitizeChat(message.body);
      if (!body) return;
      relay(ctx, connection, message.matchId, { type: "chat", matchId: message.matchId, author: connection.wallet, body, atMs: marketsProvider.nowMs() }, "chat");
      return;
    }

    case "reaction":
      relay(ctx, connection, message.matchId, { type: "reaction", matchId: message.matchId, author: connection.wallet, reaction: message.reaction, atMs: marketsProvider.nowMs() }, "reaction");
      return;
  }
}

/** A player leaving is a presence change for whoever is left, not a silent disappearance. */
export function announceDeparture(ctx: RoomContext, connection: RoomConnection): void {
  ctx.matchmaker?.leave(connection);
  const key = connection.room?.key;
  ctx.hub.close(connection);
  if (!key) return;
  const presence = ctx.hub.presenceOf(key);
  if (presence) ctx.hub.broadcast(key, presence);
}

/**
 * Re-sends every connection in a match's room a whole snapshot.
 *
 * This is how the projector answers an event it cannot translate into a delta — a deck reveal, whose
 * log carries market ids where a stage needs Windows. Building it once and addressing it per connection
 * costs one chain read rather than one per player, and every player lands on identical state, which is
 * the property a delta cannot promise.
 */
export async function resnapshotRoom(ctx: RoomContext, matchId: Bytes32): Promise<number> {
  const ref = roomRef(ctx.chainId, ctx.arena, matchId);
  const built = await buildMatchSnapshot(matchId, ctx.chainId);
  if (!built.ok) {
    ctx.log(`${matchId}: cannot re-snapshot the room: ${built.why}`);
    return 0;
  }
  if (built.warning) ctx.log(built.warning);

  // A chain event for this match proves the arena holds it; the pre-chain record is spent.
  ctx.matchmaker?.releasePending(matchId);
  const state = encodeMatchState(built.state);
  const serverTimeMs = marketsProvider.nowMs();
  let sent = 0;
  for (const connection of ctx.hub.connections()) {
    if (connection.room?.key !== ref.key) continue;
    ctx.hub.send(connection, { type: "snapshot", serverTimeMs, wallet: connection.wallet, room: ref, state });
    sent += 1;
  }
  return sent;
}
