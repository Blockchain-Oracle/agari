import { createHash, randomBytes } from "node:crypto";
import {
  envelopeCheck,
  FLAP_ENGINE_VERSION,
  isArcadeSeed,
  MAX_RUN_TICKS,
  replayArcade,
  RIDE_ENGINE_VERSION,
  seedFromBytes,
  ticksToMs,
  traceCanonical,
  type ArcadeGame,
} from "@masayume/core/games/arcade";
import { arcadeRankOf, bestArcadeOf, gamesStoreConfigured, listArcadeBoard, recordArcadeScore } from "@masayume/db";
import { z } from "zod";
import { gate } from "@/features/session/sponsor.server";
import { walletFromRoomToken } from "../room-token.server";
import type { BoardWire, ScoreAcceptedWire } from "./wire";

/**
 * Accepting an arcade score — server only. Nothing here may be imported by a component.
 *
 * The order is the whole design, cheapest refusal first: the shape, the store, the identity, the engine
 * build, the envelope, then the replay, then the rate limit, then the row. The replay is the check:
 * the server runs the same engine over the same seed and inputs and accepts only a score it reproduced
 * to the tick. A run longer than the replay budget is refused rather than accepted on its envelope,
 * because an envelope is a bound and a board with a bound on it is a board anyone can top.
 *
 * What this cannot prove is that a browser was not driven by a script, and it does not claim to: the
 * label is "server-checked · not on-chain", and doc 06 forbids prize money from depending on these.
 */
export const ENGINE_VERSION: Readonly<Record<ArcadeGame, number>> = { "line-rider": RIDE_ENGINE_VERSION, "candle-hop": FLAP_ENGINE_VERSION };

/** The board a title shows and the rank an over plate names come from the same ten rows. */
export const BOARD_LIMIT = 10;
/** Sliding-hour caps, per wallet and per device, on the vault lane's own `gate`. A run is a minute; nobody plays two a second. */
const PER_ADDRESS_PER_HOUR = 120;
const PER_DEVICE_PER_HOUR = 240;

export const scoreClaimSchema = z.object({
  game: z.enum(["line-rider", "candle-hop"]),
  token: z.string().min(16).max(400),
  seed: z.string().refine(isArcadeSeed, "not an arcade seed"),
  engineVersion: z.number().int().positive(),
  durationMs: z.number().int().positive(),
  score: z.number().int().nonnegative(),
  calm: z.boolean(),
  trace: z.array(z.number().int().nonnegative()).max(MAX_RUN_TICKS * 2),
});

export type ScoreClaim = z.infer<typeof scoreClaimSchema>;

export type ScoreVerdict = { ok: true; body: ScoreAcceptedWire } | { ok: false; status: number; error: string };

export function freshSeed(): string {
  return seedFromBytes(randomBytes(4));
}

export async function readBoard(game: ArcadeGame, address: string | null): Promise<BoardWire> {
  const engineVersion = ENGINE_VERSION[game];
  const seed = freshSeed();
  if (!gamesStoreConfigured()) return { configured: false, seed, engineVersion, rows: [], me: null };
  const rows = await listArcadeBoard(game, engineVersion, BOARD_LIMIT);
  let me: BoardWire["me"] = null;
  if (address) {
    const best = await bestArcadeOf(address, game, engineVersion);
    if (best !== null) me = { best, rank: await arcadeRankOf(game, engineVersion, best) };
  }
  return { configured: true, seed, engineVersion, rows, me };
}

export async function acceptScore(claim: ScoreClaim, device: string, nowMs: number): Promise<ScoreVerdict> {
  if (!gamesStoreConfigured()) return { ok: false, status: 503, error: "This deployment keeps no scores." };

  const identity = walletFromRoomToken(claim.token, nowMs);
  if (!identity.ok) return identity;
  const wallet = identity.wallet;

  const engineVersion = ENGINE_VERSION[claim.game];
  if (claim.engineVersion !== engineVersion) return { ok: false, status: 409, error: "that run was played on another engine build" };

  const envelope = envelopeCheck(claim.game, claim.durationMs, claim.trace, claim.score);
  if (!envelope.ok) return { ok: false, status: 422, error: envelope.why };

  const replay = replayArcade(claim.game, claim.seed, claim.trace, { calm: claim.calm });
  if (!replay.ended) return { ok: false, status: 422, error: "the run never ended" };
  if (replay.score !== claim.score) return { ok: false, status: 422, error: "the replay does not reproduce that score" };
  if (Math.abs(replay.ticks - envelope.ticks) > 1) return { ok: false, status: 422, error: "the replay does not reproduce that length" };

  const byDevice = gate("device", device, PER_DEVICE_PER_HOUR, nowMs);
  if (!byDevice.ok) return { ok: false, status: 429, error: byDevice.reason };
  const byAddress = gate("address", wallet, PER_ADDRESS_PER_HOUR, nowMs);
  if (!byAddress.ok) return { ok: false, status: 429, error: byAddress.reason };

  const previous = await bestArcadeOf(wallet, claim.game, engineVersion);
  const isBest = previous === null || claim.score > previous;
  await recordArcadeScore({
    game: claim.game,
    wallet,
    score: claim.score,
    engineVersion,
    durationMs: ticksToMs(replay.ticks),
    seed: claim.seed,
    traceHash: createHash("sha256").update(traceCanonical(claim.trace)).digest("hex"),
    calm: claim.calm,
  });
  const rank = await arcadeRankOf(claim.game, engineVersion, claim.score);
  const board = await readBoard(claim.game, wallet);
  return { ok: true, body: { rank, isBest, board } };
}
