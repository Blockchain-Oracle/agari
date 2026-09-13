import { activeMatchFor } from "@masayume/db";
import type { Address, Bytes32 } from "@masayume/core/types";
import { ensureMarkets, parseMarketsEnv } from "@masayume/markets";
import { resolveArenaDeployment } from "@masayume/markets/games";
import { readRoomEnv, ROOM_ENV } from "./env";
import { createRoomHub } from "./hub";
import type { RoomContext } from "./handlers";
import { createMatchmaker } from "../matchmaker";
import { startRoomServer } from "./server";

type Log = (why: string) => void;

/**
 * The duel room actor: one `ws` listener, one hub, and nothing durable of its own.
 *
 * It refuses to listen in two cases rather than pretending. Without `ROOM_TOKEN_SECRET` every token
 * would verify, so an unset (or trivially short) secret idles the actor — the same rule the keeper
 * applies to a missing key. And with no `GameArena` on the configured chain there is no match to
 * reconstruct, so a room would be a socket that can only ever answer "unknown match".
 *
 * The context is returned so the projector and the settler can broadcast into rooms without either of
 * them owning the transport: chain events reach a browser through this one socket registry, and nothing
 * else in ops writes to a client.
 */
export async function startGameRoom(log: Log): Promise<RoomContext | null> {
  const env = readRoomEnv();
  if (!env.secret) {
    log(`no ${ROOM_ENV.secret} of at least 16 characters; the duel room is not listening`);
    return null;
  }

  const marketsEnv = parseMarketsEnv({ venueId: env.venueId });
  ensureMarkets(marketsEnv);
  const deployment = resolveArenaDeployment(marketsEnv);
  if (!deployment) {
    log("GameArena is not deployed on this network; the duel room is not listening");
    return null;
  }

  const hub = createRoomHub();
  const ctx: RoomContext = {
    hub,
    chainId: deployment.chainId,
    arena: deployment.gameArena,
    log,
    matchmaker: null,
    /**
     * A browser that has lost its own memory asks the projection what it is in. Without a database the
     * answer is "nothing I can prove", and the client falls back to the match id it already holds —
     * never to a guess.
     */
    directory: {
      activeMatchFor: async (wallet: Address) =>
        (await activeMatchFor(wallet, deployment.chainId, deployment.gameArena)) as Bytes32 | null,
    },
  };

  // The matchmaker needs the context it is part of, so it is attached rather than constructed with it.
  ctx.matchmaker = createMatchmaker(ctx);

  const server = startRoomServer({ ctx, env: { ...env, secret: env.secret } });
  log(`listening on ws://${env.host}:${env.port} for arena ${deployment.gameArena} on chain ${deployment.chainId}`);

  const stop = () => void server.close().then(() => log("closed"));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return ctx;
}
