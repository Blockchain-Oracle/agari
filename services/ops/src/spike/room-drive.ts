import { mintRoomToken, roomSessionClaims, ROOM_PROTOCOL_VERSION, type ServerMessage } from "@masayume/core/games";
import type { Address } from "@masayume/core/types";
import { parseMarketsEnv } from "@masayume/markets";
import { resolveArenaDeployment } from "@masayume/markets/games";
import { WebSocket } from "ws";
import { startGameRoom } from "../actors/game-room";
import { roomMac } from "../actors/game-room/token";

/**
 * Drives the real duel room over a real socket: starts the actor, mints real tokens, and checks what a
 * browser would actually see — the handshake, the refusals, the rate limit, and a reconnect that rebuilds
 * a live Shannon match from the chain alone.
 *
 *   MATCH_ID=0x… pnpm --filter @masayume/ops spike:room
 *
 * `MATCH_ID` is optional; without it the chain-backed checks are skipped and the transport is still
 * proven. With it, the last check is the slice's acceptance criterion in one line: a socket that has
 * never seen this match reconstructs it whole.
 */
const PORT = Number(process.env.GAME_ROOM_PORT ?? 8799);
const SECRET = process.env.ROOM_TOKEN_SECRET ?? "spike-secret-at-least-16-chars";
const WALLET = (process.env.WALLET ?? "0xd357000000000000000000000000000000009358").toLowerCase() as Address;
const MATCH_ID = process.env.MATCH_ID ?? null;

process.env.ROOM_TOKEN_SECRET = SECRET;
process.env.GAME_ROOM_PORT = String(PORT);

let failures = 0;
function check(name: string, pass: boolean, detail = ""): void {
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

interface Client {
  socket: WebSocket;
  inbox: ServerMessage[];
  next(type?: string, timeoutMs?: number): Promise<ServerMessage>;
  send(message: unknown): void;
  close(): void;
}

async function connect(token: string): Promise<Client | number> {
  const socket = new WebSocket(`ws://127.0.0.1:${PORT}/`, ["masayume.room.v1", token]);
  const inbox: ServerMessage[] = [];
  const waiters: ((m: ServerMessage) => void)[] = [];
  socket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as ServerMessage;
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else inbox.push(message);
  });

  const opened = await new Promise<true | number>((resolve) => {
    socket.once("open", () => resolve(true));
    // `unexpected-response` is how `ws` surfaces the room's 401: the upgrade never happened.
    socket.once("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
    socket.once("error", () => resolve(0));
  });
  if (opened !== true) return opened;

  return {
    socket,
    inbox,
    send: (message) => socket.send(JSON.stringify(message)),
    close: () => socket.close(),
    next(type, timeoutMs = 15_000) {
      return new Promise<ServerMessage>((resolve, reject) => {
        const at = inbox.findIndex((m) => !type || m.type === type);
        if (at !== -1) return resolve(inbox.splice(at, 1)[0] as ServerMessage);
        const timer = setTimeout(() => reject(new Error(`waited ${timeoutMs}ms for ${type ?? "any message"}`)), timeoutMs);
        waiters.push((message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
    },
  };
}

function tokenFor(chainId: number, arena: Address, wallet: Address = WALLET, nowMs = Date.now()): string {
  return mintRoomToken(roomSessionClaims(wallet, wallet, chainId, arena, nowMs), (payload) => roomMac(SECRET, payload));
}

async function main(): Promise<void> {
  const deployment = resolveArenaDeployment(parseMarketsEnv());
  if (!deployment) throw new Error("no GameArena on this network; nothing to drive");
  const { chainId, gameArena: arena } = deployment;
  console.log(`arena ${arena} on chain ${chainId}, room on :${PORT}\n`);

  const hub = await startGameRoom((why) => console.log(`  [room] ${why}`));
  check("the actor listens", hub !== null);
  if (!hub) return;

  // 1. A forged token never reaches a socket.
  const forged = await connect(`${tokenFor(chainId, arena)}tampered`);
  check("a tampered token is refused at the upgrade", forged === 401, `status ${forged}`);

  // 2. A token for another arena is refused too, even though its MAC is ours.
  const elsewhere = await connect(tokenFor(chainId, `0x${"11".repeat(20)}` as Address));
  check("a token for another arena is refused", elsewhere === 401, `status ${elsewhere}`);

  // 3. The handshake.
  const client = await connect(tokenFor(chainId, arena));
  if (typeof client === "number") return check("a good token connects", false, `status ${client}`);
  check("a good token connects", true);

  client.send({ type: "chat", matchId: `0x${"11".repeat(32)}`, body: "before hello" });
  const early = await client.next("error");
  check("nothing is answered before hello", early.type === "error" && early.code === "bad-protocol", JSON.stringify(early));

  client.send({ type: "hello", protocolVersion: ROOM_PROTOCOL_VERSION });
  const snapshot = await client.next("snapshot");
  check(
    "hello with no match answers an idle snapshot",
    snapshot.type === "snapshot" && snapshot.state.phase === "idle" && snapshot.wallet === WALLET,
    JSON.stringify(snapshot),
  );

  // 4. The refusals a browser has to be able to tell apart.
  client.send({ type: "resync", matchId: "not-a-match" });
  const bad = await client.next("error");
  check("a malformed match id is a refusal, not an RPC error", bad.type === "error" && bad.code === "bad-message");

  client.send("{not json");
  const garbage = await client.next("error");
  check("garbage is refused without closing the socket", garbage.type === "error" && garbage.code === "bad-message");

  client.send({ type: "queue.join", mode: "ranked", tier: "t1", region: "default", clientSeedCommitment: "0xabc" });
  const queue = await client.next("error");
  check("the queue refuses honestly while no matchmaker runs", queue.type === "error" && queue.code === "queue-unavailable");

  // 5. The rate limit: chat bursts four, then refuses.
  for (let i = 0; i < 6; i += 1) client.send({ type: "chat", matchId: `0x${"11".repeat(32)}`, body: `line ${i}` });
  const limited = await client.next("rate-limited" as never).catch(() => null);
  const limitHit = limited?.type === "error" && limited.code === "rate-limited";
  check("a chat flood is rate-limited", limitHit || client.inbox.some((m) => m.type === "error" && m.code === "rate-limited"));

  // 6. The acceptance criterion, against a real match.
  if (MATCH_ID) {
    const fresh = await connect(tokenFor(chainId, arena));
    if (typeof fresh === "number") return check("a second socket connects", false, `status ${fresh}`);
    fresh.send({ type: "hello", protocolVersion: ROOM_PROTOCOL_VERSION, resumeMatchId: MATCH_ID });
    const rebuilt = await fresh.next();
    if (rebuilt.type === "snapshot") {
      check("a socket that never saw the match rebuilds it from chain", true, `${rebuilt.state.phase} · room ${rebuilt.room?.key}`);
      console.log(`\n${JSON.stringify(rebuilt.state, null, 2)}\n`);
    } else {
      check("a socket that never saw the match rebuilds it from chain", false, JSON.stringify(rebuilt));
    }
    // A wallet that is not in the match gets no view of it, however good its token.
    const stranger = await connect(tokenFor(chainId, arena, `0x${"22".repeat(20)}` as Address));
    if (typeof stranger === "number") return check("a stranger connects", false, `status ${stranger}`);
    stranger.send({ type: "hello", protocolVersion: ROOM_PROTOCOL_VERSION, resumeMatchId: MATCH_ID });
    const refused = await stranger.next();
    check("a wallet outside the match is refused its room", refused.type === "error" && refused.code === "forbidden", JSON.stringify(refused));
    stranger.close();

    fresh.close();
  } else {
    console.log("SKIP  the chain-backed reconnect (no MATCH_ID)");
  }

  client.close();
  console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
  process.exitCode = failures === 0 ? 0 : 1;
  setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
