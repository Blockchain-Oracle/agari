import { mintRoomToken, roomSessionClaims, ROOM_PROTOCOL_VERSION, type ServerMessage } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32, Hex } from "@masayume/core/types";
import { closeRuntime, createMemoryJournal, createSubmitterSession, ensureMarkets, loadCollateral, parseMarketsEnv } from "@masayume/markets";
import { resolveArenaDeployment, sendArenaIntent } from "@masayume/markets/games";
import { WebSocket } from "ws";
import { startDuelProjector } from "../actors/duel-projector";
import { startGameRoom } from "../actors/game-room";
import { roomMac } from "../actors/game-room/token";
import { finish } from "./finish";

/**
 * The whole chain-to-browser path, live: a socket joins a real Shannon match, a real transaction changes
 * it, and the projector delivers that change to the socket without anyone asking.
 *
 *   PLAYER_KEY=… MATCH_ID=0x… FROM_BLOCK=… pnpm --filter @masayume/ops spike:duel-live
 *
 * It cancels the match it is given, because a creator's cancel is the one terminal event a single
 * wallet can cause on demand — no opponent, no deadline to wait out, no settlement to wait for.
 */
const PORT = Number(process.env.GAME_ROOM_PORT ?? 8798);
const SECRET = process.env.ROOM_TOKEN_SECRET ?? "spike-secret-at-least-16-chars";
const MATCH_ID = (process.env.MATCH_ID ?? "") as Bytes32;

process.env.ROOM_TOKEN_SECRET = SECRET;
process.env.GAME_ROOM_PORT = String(PORT);
if (process.env.FROM_BLOCK) process.env.GAME_PROJECTOR_FROM = process.env.FROM_BLOCK;

let failures = 0;
function check(name: string, pass: boolean, detail = ""): void {
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** One listener for the socket's whole life, so a message is logged once however many waits are open. */
function listen(socket: WebSocket): (type: string, timeoutMs?: number) => Promise<ServerMessage> {
  const waiting = new Map<string, (message: ServerMessage) => void>();
  const seen: ServerMessage[] = [];
  socket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as ServerMessage;
    console.log(`  <- ${message.type}`);
    const waiter = waiting.get(message.type);
    if (waiter) {
      waiting.delete(message.type);
      waiter(message);
    } else {
      seen.push(message);
    }
  });
  return (type, timeoutMs = 90_000) =>
    new Promise<ServerMessage>((resolve, reject) => {
      const at = seen.findIndex((m) => m.type === type);
      if (at !== -1) return resolve(seen.splice(at, 1)[0] as ServerMessage);
      const timer = setTimeout(() => reject(new Error(`waited ${timeoutMs}ms for ${type}`)), timeoutMs);
      waiting.set(type, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
}

async function main(): Promise<void> {
  const key = process.env.PLAYER_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("PLAYER_KEY is required");
  if (!/^0x[0-9a-f]{64}$/.test(MATCH_ID)) throw new Error("MATCH_ID is required");

  const env = parseMarketsEnv();
  ensureMarkets(env);
  const deployment = resolveArenaDeployment(env);
  if (!deployment) throw new Error("no GameArena on this network");
  const collateral = await loadCollateral();
  if (!isOk(collateral)) throw new Error("collateral unreadable");

  const room = await startGameRoom((why) => console.log(`  [room] ${why}`));
  check("the room is listening", room !== null);
  if (!room) return;
  await startDuelProjector((why) => console.log(`  [projector] ${why}`), room);

  const session = await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: key as Hex }, journal: createMemoryJournal() });
  const wallet = session.address.toLowerCase() as Address;
  const token = mintRoomToken(roomSessionClaims(wallet, wallet, deployment.chainId, deployment.gameArena, Date.now()), (payload) => roomMac(SECRET, payload));

  const socket = new WebSocket(`ws://127.0.0.1:${PORT}/`, ["masayume.room.v1", token]);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });

  const waitFor = listen(socket);
  const snapshot = waitFor("snapshot");
  socket.send(JSON.stringify({ type: "hello", protocolVersion: ROOM_PROTOCOL_VERSION, resumeMatchId: MATCH_ID }));
  const state = await snapshot;
  check("the socket is in the match's room", state.type === "snapshot" && state.room !== null, state.type === "snapshot" ? state.state.phase : state.type);

  // Now change the chain, and say nothing to the socket about it.
  const refunded = waitFor("match.refunded");
  const sent = await sendArenaIntent(session.contracts, { kind: "arena-cancel", matchId: MATCH_ID });
  console.log(`  cancelled in ${sent.hash} · gas ${sent.receipt.gasUsed}`);

  const message = await refunded;
  check(
    "the projector delivered the chain's own refund to a live socket",
    message.type === "match.refunded" && message.reason === "creator-cancelled",
    JSON.stringify(message),
  );

  socket.close();
  await session.dispose();
  await closeRuntime();
  console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
  process.exitCode = failures === 0 ? 0 : 1;
  setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
}

void main()
  .then(() => finish(0))
  .catch((error: unknown) => {
    console.error(error);
    finish(1);
  });
