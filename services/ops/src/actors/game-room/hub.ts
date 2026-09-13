import { createRateState, type RateState, type RoomRef, type ServerMessage } from "@masayume/core/games";
import type { Address } from "@masayume/core/types";
import { WebSocket } from "ws";

/**
 * Who is connected, and which match they are watching.
 *
 * Everything here is process memory with no durability on purpose (`06-game-architecture.md`: "Queue,
 * presence, typing and reactions are process memory with TTL"). A restart drops it all and loses
 * nothing that matters — the match is on chain, its history is in Postgres, and a reconnecting client
 * is answered with a snapshot rebuilt from both. What must NOT be here is anything a snapshot cannot
 * rebuild, which is why the hub holds no state about picks, pots or ratings.
 *
 * One wallet may hold several connections — two tabs, or a phone finishing a swipe while a laptop
 * watches — so rooms are keyed by connection and presence is folded by wallet.
 */

export interface RoomConnection {
  id: string;
  wallet: Address;
  /** The browser key that signed the token — what a seat's on-chain agent record is checked against. */
  key: Address;
  socket: WebSocket;
  rates: RateState;
  room: RoomRef | null;
  /** Answered the last ping. A connection that misses one is terminated rather than written to forever. */
  alive: boolean;
  lastSeenMs: number;
  /** `hello` has been accepted; nothing else is answered before it. */
  greeted: boolean;
}

interface Room {
  ref: RoomRef;
  /** The match's two players, recorded from the arena when the room is first opened. */
  players: readonly Address[];
  members: Set<RoomConnection>;
}

export interface RoomHub {
  open(socket: WebSocket, wallet: Address, key: Address, nowMs: number): RoomConnection;
  close(connection: RoomConnection): void;
  /** `players` is the match's roster from the arena, so presence can report an absent player as absent. */
  join(connection: RoomConnection, ref: RoomRef, players: readonly Address[]): void;
  send(connection: RoomConnection, message: ServerMessage): void;
  /** Everyone in the room, optionally except the sender. Returns how many were actually written to. */
  broadcast(key: string, message: ServerMessage, except?: RoomConnection): number;
  /** Every connection of one wallet, wherever it is — how the projector reaches a player mid-queue. */
  toWallet(wallet: Address, message: ServerMessage): number;
  presenceOf(key: string): Extract<ServerMessage, { type: "presence" }> | null;
  connections(): readonly RoomConnection[];
  stats(): { connections: number; rooms: number };
}

export function createRoomHub(): RoomHub {
  const all = new Set<RoomConnection>();
  const rooms = new Map<string, Room>();
  let seq = 0;

  function leave(connection: RoomConnection): void {
    if (!connection.room) return;
    const room = rooms.get(connection.room.key);
    connection.room = null;
    if (!room) return;
    room.members.delete(connection);
    if (room.members.size === 0) rooms.delete(room.ref.key);
  }

  function send(connection: RoomConnection, message: ServerMessage): void {
    if (connection.socket.readyState !== WebSocket.OPEN) return;
    connection.socket.send(JSON.stringify(message));
  }

  return {
    open(socket, wallet, key, nowMs) {
      seq += 1;
      const connection: RoomConnection = {
        id: `c${seq}`,
        wallet: wallet.toLowerCase() as Address,
        key: key.toLowerCase() as Address,
        socket,
        rates: createRateState(),
        room: null,
        alive: true,
        lastSeenMs: nowMs,
        greeted: false,
      };
      all.add(connection);
      return connection;
    },

    close(connection) {
      leave(connection);
      all.delete(connection);
    },

    join(connection, ref, players) {
      if (connection.room?.key === ref.key) return;
      leave(connection);
      const room = rooms.get(ref.key) ?? { ref, players, members: new Set<RoomConnection>() };
      room.members.add(connection);
      rooms.set(ref.key, room);
      connection.room = ref;
    },

    send,

    broadcast(key, message, except) {
      const room = rooms.get(key);
      if (!room) return 0;
      let written = 0;
      for (const member of room.members) {
        if (member === except) continue;
        send(member, message);
        written += 1;
      }
      return written;
    },

    toWallet(wallet, message) {
      const who = wallet.toLowerCase();
      let written = 0;
      for (const connection of all) {
        if (connection.wallet !== who) continue;
        send(connection, message);
        written += 1;
      }
      return written;
    },

    /**
     * Who is in this room, folded by wallet. Both players are always listed — a player who has not
     * connected is `online: false` rather than absent, because "your opponent is not here" is the fact
     * the stage needs, and an empty list looks like a room that is still loading.
     */
    presenceOf(key) {
      const room = rooms.get(key);
      if (!room) return null;
      const seen = new Map<string, number>();
      for (const member of room.members) seen.set(member.wallet, Math.max(seen.get(member.wallet) ?? 0, member.lastSeenMs));
      const players = room.players.slice(0, 2).map((wallet) => {
        const lastSeenMs = seen.get(wallet.toLowerCase()) ?? 0;
        return { wallet: wallet.toLowerCase() as Address, online: lastSeenMs > 0, lastSeenMs };
      });
      return { type: "presence", room: room.ref, players };
    },

    connections() {
      return [...all];
    },

    stats() {
      return { connections: all.size, rooms: rooms.size };
    },
  };
}
