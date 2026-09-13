import type { ArenaDeployment } from "@masayume/core/games";
import type { Address } from "@masayume/core/types";
import masayume from "../addresses.masayume.json";
import { SOMNIA_SHANNON_ID } from "../chain";
import type { MarketsEnv } from "../env";

interface Record {
  gameArena?: string;
  gameArenaFromBlock?: number | string;
}

const DEPLOYMENTS = (masayume as { deployments: globalThis.Record<string, Record> }).deployments;

/**
 * Where the GameArena lives for the configured chain, or null when it is not deployed there. The
 * generated module is the source of truth (AD-10 lockstep); an env override exists for a local fork.
 */
export function resolveArenaDeployment(env: Partial<Pick<MarketsEnv, "chainId" | "gameArenaAddress" | "gameArenaFromBlock">> = {}): ArenaDeployment | null {
  const chainId = env.chainId ?? SOMNIA_SHANNON_ID;
  const record = DEPLOYMENTS[String(chainId)];
  const gameArena = (env.gameArenaAddress ?? record?.gameArena) as Address | undefined;
  if (!gameArena) return null;
  const fromBlock = env.gameArenaFromBlock ?? (record?.gameArenaFromBlock !== undefined ? BigInt(record.gameArenaFromBlock) : 0n);
  return { chainId, gameArena, fromBlock };
}
