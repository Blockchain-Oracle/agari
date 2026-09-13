import {
  allowMessage,
  clientMessageSchema,
  roomError,
  verifyRoomToken,
  ROOM_HEARTBEAT_GRACE_MS,
  ROOM_HEARTBEAT_MS,
  ROOM_MAX_PAYLOAD_BYTES,
  type RoomTokenClaims,
} from "@masayume/core/games";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import type { RoomEnv } from "./env";
import { announceDeparture, handleMessage, type RoomContext } from "./handlers";
import { roomMacVerifier } from "./token";

/**
 * The transport: one `ws` server on its own HTTP listener, beside the Next request lifecycle rather
 * than inside it (`06-game-architecture.md` §Matchmaking, realtime and reconnect).
 *
 * **The token rides in `Sec-WebSocket-Protocol`.** A WebSocket upgrade is a GET with no body, and the
 * browser's `WebSocket` constructor sets no headers — but it does send subprotocols, which is the one
 * place a credential can travel without ending up in a URL, and therefore without ending up in an
 * access log, a proxy history or a `Referer`. A `?token=` query is accepted too, because curl and a test
 * harness have no other way, and its use is logged so it does not become the quiet default.
 *
 * **A refused upgrade is an HTTP 401, not a WebSocket that closes.** A client that cannot tell "your
 * token expired" from "the server went away" will reconnect forever with the same dead token.
 *
 * **Liveness is measured, not assumed.** A phone that sleeps mid-match leaves a socket that is open to
 * the kernel and dead to the player; the heartbeat closes it after one missed ping plus grace, and the
 * player reconnects into a snapshot rather than into a socket nobody is reading.
 */

const SUBPROTOCOL = "masayume.room.v1";

function offeredProtocols(req: IncomingMessage): readonly string[] {
  const header = req.headers["sec-websocket-protocol"];
  const raw = Array.isArray(header) ? header.join(",") : (header ?? "");
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function tokenOf(req: IncomingMessage): { token: string | null; fromQuery: boolean } {
  // The token is whichever offered protocol is not ours: its own version prefix is core's to check, not this file's.
  const offered = offeredProtocols(req).find((part) => part !== SUBPROTOCOL && part.includes("."));
  if (offered) return { token: offered, fromQuery: false };
  const url = new URL(req.url ?? "/", "http://room.invalid");
  return { token: url.searchParams.get("token"), fromQuery: true };
}

function refuse(socket: Duplex, status: number, why: string): void {
  socket.write(`HTTP/1.1 ${status} ${status === 401 ? "Unauthorized" : "Bad Request"}\r\nConnection: close\r\nContent-Length: 0\r\nX-Room-Refusal: ${why}\r\n\r\n`);
  socket.destroy();
}

export interface RoomServer {
  http: Server;
  close(): Promise<void>;
}

export interface RoomServerOptions {
  ctx: RoomContext;
  env: RoomEnv & { secret: string };
}

export function startRoomServer({ ctx, env }: RoomServerOptions): RoomServer {
  const verifyMac = roomMacVerifier(env.secret);
  const expect = { chainId: ctx.chainId, arena: ctx.arena };
  const wss = new WebSocketServer({ noServer: true, maxPayload: ROOM_MAX_PAYLOAD_BYTES, handleProtocols: () => SUBPROTOCOL });

  function json(res: ServerResponse, value: unknown): void {
    const body = JSON.stringify(value);
    res.writeHead(200, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
      // Read by a page that has no wallet and no token, from the Next server rather than the browser.
      "cache-control": "no-store",
    });
    res.end(body);
  }

  const http = createServer((req, res) => {
    if (req.url?.startsWith("/health")) {
      return json(res, { ok: true, ...ctx.hub.stats(), arena: ctx.arena, chainId: ctx.chainId });
    }
    /**
     * Who is waiting, with no credential at all.
     *
     * A duel used to show a player nothing until they had connected a wallet and signed, so "is anyone
     * even here?" — the one question that decides whether to bother — could only be answered by paying
     * a signature to find out. Occupancy is not private: it is counts per queue, no wallets, no ratings,
     * and the room already broadcasts the same number to everyone standing in one.
     */
    if (req.url?.startsWith("/occupancy")) {
      const occupancy = ctx.matchmaker?.occupancy() ?? { queues: [], pairing: 0 };
      return json(res, { ...occupancy, online: ctx.hub.stats().connections, arena: ctx.arena, chainId: ctx.chainId });
    }
    res.writeHead(404).end();
  });

  http.on("upgrade", (req, socket, head) => {
    const { token, fromQuery } = tokenOf(req);
    if (!token) return refuse(socket, 401, "no room token");
    const verdict = verifyRoomToken(token, expect, Date.now(), verifyMac);
    if (!verdict.ok) return refuse(socket, 401, verdict.code);
    if (fromQuery) ctx.log(`${verdict.claims.wallet}: room token arrived in the query string; the subprotocol keeps it out of logs`);
    wss.handleUpgrade(req, socket, head, (ws) => accept(ws, verdict.claims));
  });

  function accept(socket: WebSocket, claims: RoomTokenClaims): void {
    const connection = ctx.hub.open(socket, claims.wallet, claims.key, Date.now());
    ctx.log(`${connection.id} ${connection.wallet} (key ${connection.key}): connected (${ctx.hub.stats().connections} open)`);

    socket.on("pong", () => {
      connection.lastSeenMs = Date.now();
      connection.alive = true;
    });

    socket.on("message", (data, isBinary) => {
      const nowMs = Date.now();
      connection.lastSeenMs = nowMs;
      if (isBinary) return ctx.hub.send(connection, roomError("bad-message", "this room speaks JSON text"));

      let value: unknown;
      try {
        value = JSON.parse(data.toString());
      } catch {
        return ctx.hub.send(connection, roomError("bad-message", "that was not JSON"));
      }

      const parsed = clientMessageSchema.safeParse(value);
      if (!parsed.success) return ctx.hub.send(connection, roomError("bad-message", "that is not a message this room accepts"));
      if (!allowMessage(connection.rates, parsed.data.type, nowMs)) {
        return ctx.hub.send(connection, roomError("rate-limited", `too many ${parsed.data.type} messages`, parsed.data.type));
      }

      void handleMessage(ctx, connection, parsed.data).catch((error: unknown) => {
        ctx.log(`${connection.id} ${parsed.data.type} failed: ${error instanceof Error ? error.message : String(error)}`);
        ctx.hub.send(connection, roomError("internal", "the room could not answer that", parsed.data.type));
      });
    });

    socket.on("close", () => {
      announceDeparture(ctx, connection);
      ctx.log(`${connection.id} ${connection.wallet}: gone (${ctx.hub.stats().connections} open)`);
    });

    socket.on("error", (error) => ctx.log(`${connection.id}: socket error ${error.message}`));
  }

  /** One ping a cycle; a connection silent for a cycle plus its grace is closed rather than written to. */
  const heartbeat = setInterval(() => {
    const nowMs = Date.now();
    for (const connection of ctx.hub.connections()) {
      if (nowMs - connection.lastSeenMs > ROOM_HEARTBEAT_MS + ROOM_HEARTBEAT_GRACE_MS) {
        ctx.log(`${connection.id} ${connection.wallet}: silent past the heartbeat; closing`);
        connection.socket.terminate();
        continue;
      }
      connection.alive = false;
      connection.socket.ping();
    }
  }, ROOM_HEARTBEAT_MS);
  heartbeat.unref();

  http.listen(env.port, env.host);

  return {
    http,
    async close() {
      clearInterval(heartbeat);
      for (const connection of ctx.hub.connections()) connection.socket.close(1001, "the room is restarting");
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
