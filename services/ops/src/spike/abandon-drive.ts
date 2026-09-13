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
 * The failure a live session actually hit, driven on purpose: an opponent who disappears mid-pairing.
 *
 *   pnpm --filter @masayume/ops spike:abandon
 *
 * On 2026-09-04 a browser closed between `match.found` and its seed reveal. The room dissolved the
 * pairing and put BOTH players back in the queue — including the one whose socket was already closing —
 * so the survivor was paired with a ghost, waited out the fifteen-second seed window, and was paired
 * with the same ghost again on the very next tick. Four pairings in thirty seconds, none of which could
 * ever produce a deck, and the survivor's screen said "sealing the deck…" through all of it because a
 * dissolve travelled as an `error`, which carries no lifecycle meaning.
 *
 * Every check here is one sentence of that paragraph, inverted:
 *
 *   1. the survivor is TOLD, as `match.dissolved` and not as an error string
 *   2. no ghost is left in the queue, so no second pairing happens
 *   3. a real opponent arriving afterwards pairs normally
 *   4. the wait itself is measurable — `match.dealing` carries the deadline the room is keeping
 *   5. occupancy answers with no token at all
 *
 * It uses its own port and its own room, so it can be run against a machine with ops already up.
 */
const PORT = Number(process.env.GAME_ROOM_PORT ?? 8798);
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
  /** Resolves to null when nothing of that type arrives — the shape a "this must NOT happen" check needs. */
  none(type: string, withinMs: number): Promise<ServerMessage | null>;
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

  const take = (type: string): ServerMessage | null => {
    const at = seen.findIndex((m) => m.type === type);
    return at === -1 ? null : (seen.splice(at, 1)[0] as ServerMessage);
  };

  return {
    wallet,
    seed,
    socket,
    send: (message) => socket.send(JSON.stringify(message)),
    next: (type, timeoutMs = 30_000) =>
      new Promise<ServerMessage>((resolve, reject) => {
        const held = take(type);
        if (held) return resolve(held);
        const timer = setTimeout(() => reject(new Error(`${label} waited ${timeoutMs}ms for ${type}`)), timeoutMs);
        waiting.set(type, (message) => {
          clearTimeout(timer);
          resolve(message);
        });
      }),
    none: (type, withinMs) =>
      new Promise<ServerMessage | null>((resolve) => {
        const held = take(type);
        if (held) return resolve(held);
        const timer = setTimeout(() => {
          waiting.delete(type);
          resolve(null);
        }, withinMs);
        waiting.set(type, (message) => {
          clearTimeout(timer);
          resolve(message);
        });
      }),
  };
}

const ENTRY = { mode: "ranked", tier: "t1", region: "default" } as const;

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

  a.send({ type: "queue.join", ...ENTRY, clientSeedCommitment: keccak256(a.seed) });
  await a.next("queue.update");
  b.send({ type: "queue.join", ...ENTRY, clientSeedCommitment: keccak256(b.seed) });

  const found = await a.next("match.found");
  check("a pairing is made", found.type === "match.found");
  if (found.type !== "match.found") return;

  // The wait is measured, not spun on: the room says which deadline it is keeping and until when.
  const dealing = await a.next("match.dealing", 8_000);
  check(
    "the pairing reports what it is waiting on",
    dealing.type === "match.dealing" && dealing.givesUpAtMs > dealing.serverTimeMs && dealing.seedsIn <= 2,
    dealing.type === "match.dealing" ? `${dealing.seedsIn}/2 seeds, ${Math.round((dealing.givesUpAtMs - dealing.serverTimeMs) / 1_000)}s left` : "",
  );

  // B walks away without ever revealing its seed — the exact live failure.
  b.socket.terminate();

  const dissolved = await a.next("match.dissolved", 25_000);
  check(
    "the survivor is told the pairing is over, as a state and not an error",
    dissolved.type === "match.dissolved" && dissolved.matchId === found.room.matchId && dissolved.searchAgain,
    dissolved.type === "match.dissolved" ? dissolved.why : "",
  );

  /**
   * The heart of it. The old room re-queued the departing socket, so this window held a second
   * `match.found` against a connection with no browser behind it — and then a third, and a fourth.
   */
  const ghost = await a.none("match.found", 8_000);
  check("no ghost pairing follows", ghost === null, ghost ? "the survivor was paired with a closed socket" : "");

  const occupancy = await fetch(`http://127.0.0.1:${PORT}/occupancy`).then((r) => r.json() as Promise<{ queues: { waiting: number }[]; pairing: number }>);
  const stillQueued = occupancy.queues.reduce((sum, row) => sum + row.waiting, 0);
  check("occupancy answers with no token, and the queue is empty", stillQueued === 0 && occupancy.pairing === 0, JSON.stringify(occupancy));

  // And a real opponent arriving after all that pairs normally, which is the point of not punishing A.
  const c = await connect(chainId, arena, "C");
  c.send({ type: "hello", protocolVersion: ROOM_PROTOCOL_VERSION });
  await c.next("snapshot");
  a.send({ type: "queue.join", ...ENTRY, clientSeedCommitment: keccak256(a.seed) });
  await a.next("queue.update");
  c.send({ type: "queue.join", ...ENTRY, clientSeedCommitment: keccak256(c.seed) });
  const again = await Promise.all([a.next("match.found", 15_000), c.next("match.found", 15_000)]);
  const [againA, againC] = again;
  check(
    "the survivor pairs with the next real opponent",
    againA?.type === "match.found" && againC?.type === "match.found" && againA.room.key === againC.room.key && againA.room.matchId !== found.room.matchId,
    againA?.type === "match.found" ? againA.room.matchId : "",
  );

  a.socket.close();
  c.socket.close();
  console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
  process.exitCode = failures === 0 ? 0 : 1;
  setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
