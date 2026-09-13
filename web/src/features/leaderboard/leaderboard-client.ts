import { leaderboardPayloadSchema, toBoardData, type BoardData } from "./protocol";

export const BOARD_REFRESH_MS = 180_000;
export const BOARD_REQUEST_TIMEOUT_MS = 25_000;

/** The request is bounded even when the route or an upstream scan stops answering. */
export async function readLeaderboard(signal?: AbortSignal): Promise<BoardData> {
  const timeout = AbortSignal.timeout(BOARD_REQUEST_TIMEOUT_MS);
  const response = await fetch("/api/leaderboard", { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(`leaderboard route answered ${response.status}`);
  return toBoardData(leaderboardPayloadSchema.parse(await response.json()));
}
