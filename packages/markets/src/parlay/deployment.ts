import type { ParlayDeployment } from "@masayume/core/parlay";
import type { Address } from "@masayume/core/types";
import masayume from "../addresses.masayume.json";
import { SOMNIA_SHANNON_ID } from "../chain";
import type { MarketsEnv } from "../env";

interface Record {
  parlayReserve?: string;
  parlayReserveFromBlock?: number | string;
}

const DEPLOYMENTS = (masayume as { deployments: globalThis.Record<string, Record> }).deployments;

/**
 * Where the ParlayReserve lives for the configured chain, or null when it is not deployed there.
 * The generated module is the source of truth (AD-10 lockstep); `contracts/export.mjs` merges the
 * reserve's keys into the same per-chain record as the vault's. An env override exists for a local
 * fork, never for production.
 */
export function resolveParlayDeployment(env: Partial<Pick<MarketsEnv, "chainId" | "parlayReserveAddress" | "parlayReserveFromBlock">> = {}): ParlayDeployment | null {
  const chainId = env.chainId ?? SOMNIA_SHANNON_ID;
  const record = DEPLOYMENTS[String(chainId)];
  const parlayReserve = (env.parlayReserveAddress ?? record?.parlayReserve) as Address | undefined;
  if (!parlayReserve) return null;
  const fromBlock = env.parlayReserveFromBlock ?? (record?.parlayReserveFromBlock !== undefined ? BigInt(record.parlayReserveFromBlock) : 0n);
  return { chainId, parlayReserve, fromBlock };
}
