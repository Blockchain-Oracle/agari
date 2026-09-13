/**
 * What the duel room needs before it may listen.
 *
 * The secret is the one hard requirement. A room server without it would accept any string as a token,
 * so an absent `ROOM_TOKEN_SECRET` idles the actor and says so, in the same shape the keeper uses for a
 * missing key: report, never guess. It is the same secret the web app mints with — one value, two
 * processes, and no key exchange to get wrong.
 */
export interface RoomEnv {
  host: string;
  port: number;
  secret: string | null;
  /** Queue keys are `mode:tier:region`; one region until there is a measured reason for two. */
  region: string;
  venueId: string | undefined;
}

export const ROOM_ENV = {
  secret: "ROOM_TOKEN_SECRET",
  host: "GAME_ROOM_HOST",
  port: "GAME_ROOM_PORT",
  region: "GAME_ROOM_REGION",
} as const;

const DEFAULT_PORT = 8787;
/** Loopback by default: the room is fronted by the app's own proxy, never exposed straight to the internet. */
const DEFAULT_HOST = "127.0.0.1";

export function readRoomEnv(env: NodeJS.ProcessEnv = process.env): RoomEnv {
  const port = Number(env[ROOM_ENV.port]);
  const secret = env[ROOM_ENV.secret];
  return {
    host: env[ROOM_ENV.host] ?? DEFAULT_HOST,
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT,
    // A short secret is worse than none, because it looks configured.
    secret: secret && secret.length >= 16 ? secret : null,
    region: env[ROOM_ENV.region] ?? "default",
    venueId: env.VENUE_ID,
  };
}
