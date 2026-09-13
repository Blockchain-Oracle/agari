import { randomBytes } from "node:crypto";
import { mintRoomToken, roomSessionClaims, ROOM_PROTOCOL_VERSION, type ServerMessage } from "@masayume/core/games";
import type { Address, Bytes32 } from "@masayume/core/types";
import { parseMarketsEnv } from "@masayume/markets";
import { resolveArenaDeployment } from "@masayume/markets/games";
import { keccak256 } from "viem";
import { WebSocket } from "ws";
import { startGameRoom } from "../actors/game-room";
import { roomMac } from "../actors/game-room/token";

/**
 * Drives the queue with two real sockets: join, pair, open both seeds, receive one commitment.
 *
 *   pnpm --filter @masayume/ops spike:queue
 *
 * No chain write happens here — a commitment is off-chain, and what the players do with it (create and
 * join the match) is the browser's job in slice 8. What this proves is the ceremony: two players commit
 * to seeds before they know each other, reveal only after the pairing is fixed, and both are handed the
 * same deck hash — over a deck whose reveal material was already written to disk.
 */
const PORT = Number(process.env.GAME_ROOM_PORT ?? 8797);
const SECRET = process.env.ROOM_TOKEN_SECRET ?? "spike-secret-at-least-16-chars";

process.env.ROOM_TOKEN_SECRET = SECRET;
process.env.GAME_ROOM_PORT = String(PORT);
process.env.GAME_DECK_KEY ??= randomBytes(32).toString("hex");
process.env.GAME_DECK_JOURNAL ??= ".masayume/spike-decks.jsonl";

let failures = 0;
function check(name: string, pass: boolean, detail = ""): void {
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

interface Player {
  wallet: Address;
  seed: Bytes32;
  socket: WebSocket;
  next(type: string, timeoutMs?: number): Promise<ServerMessage>;
  send(message: unknown): void;
}

async function connect(chainId: number, arena: Address, label: string): Promise<Player> {
  const wallet = `0x${randomBytes(20).toString("hex")}` as Address;
  const seed = `0x${randomBytes(32).toString("hex")}` as Bytes32;
  const token = mintRoomToken(roomSessionClaims(wallet, wallet, chainId, arena, Date.now()), (payload) => roomMac(SECRET, payload));
  const socket = new WebSocket(`ws://127.0.0.1:${PORT}/`, ["masayume.room.v1", token]);
  const seen: ServerMessage[] = [];
  const waiting = new Map<string, (m: ServerMessage) => void>();
  socket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as ServerMessage;
    console.log(`  ${label} <- ${message.type}`);
    const waiter = waiting.get(message.type);
    if (waiter) {
      waiting.delete(message.type);
      waiter(message);
    } else seen.push(message);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  return {
    wallet,
    seed,
    socket,
    send: (message) => socket.send(JSON.stringify(message)),
    next: (type, timeoutMs = 30_000) =>
      new Promise<ServerMessage>((resolve, reject) => {
        const at = seen.findIndex((m) => m.type === type);
        if (at !== -1) return resolve(seen.splice(at, 1)[0] as ServerMessage);
        const timer = setTimeout(() => reject(new Error(`${label} waited ${timeoutMs}ms for ${type}`)), timeoutMs);
        waiting.set(type, (message) => {
          clearTimeout(timer);
          resolve(message);
        });
      }),
  };
}

async function main(): Promise<void> {
  const deployment = resolveArenaDeployment(parseMarketsEnv());
  if (!deployment) throw new Error("no GameArena on this network");
  const { chainId, gameArena: arena } = deployment;

  const room = await startGameRoom((why) => console.log(`  [room] ${why}`));
  check("the room is listening", room !== null);
  if (!room) return;

  const a = await connect(chainId, arena, "A");
  const b = await connect(chainId, arena, "B");
  for (const player of [a, b]) {
    player.send({ type: "hello", protocolVersion: ROOM_PROTOCOL_VERSION });
    await player.next("snapshot");
  }

  const entry = { mode: "ranked", tier: "t1", region: "default" } as const;
  a.send({ type: "queue.join", ...entry, clientSeedCommitment: keccak256(a.seed) });
  const alone = await a.next("queue.update");
  check("the first player waits alone", alone.type === "queue.update" && alone.waitingCount === 1, JSON.stringify(alone));

  b.send({ type: "queue.join", ...entry, clientSeedCommitment: keccak256(b.seed) });
  // Nothing is published yet: the pairing is held until both seeds are open.
  a.send({ type: "seed.reveal", matchId: `0x${"00".repeat(32)}`, seed: a.seed });
  const wrongMatch = await a.next("error");
  check("a seed for a match that is not yours is refused", wrongMatch.type === "error" && wrongMatch.code === "unknown-match");

  const found = await Promise.all([a.next("match.found"), b.next("match.found")]);
  const [foundA, foundB] = found;
  check(
    "both players are told the same match",
    foundA?.type === "match.found" && foundB?.type === "match.found" && foundA.room.key === foundB.room.key,
    foundA?.type === "match.found" ? foundA.room.matchId : "",
  );
  if (foundA?.type !== "match.found") return;

  a.send({ type: "seed.reveal", matchId: foundA.room.matchId, seed: a.seed });
  b.send({ type: "seed.reveal", matchId: foundA.room.matchId, seed: b.seed });

  const committed = await Promise.all([a.next("deck.committed"), b.next("deck.committed")]);
  const [ca, cb] = committed;
  const same = ca?.type === "deck.committed" && cb?.type === "deck.committed" && ca.commitment.hash === cb.commitment.hash;
  check("both players are handed one deck commitment", same, ca?.type === "deck.committed" ? `${ca.commitment.size} cards · ${ca.commitment.hash}` : "");

  a.socket.close();
  b.socket.close();
  console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
  process.exitCode = failures === 0 ? 0 : 1;
  setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
