import type { RangeDeployment } from "@masayume/core/range";
import type { Address } from "@masayume/core/types";
import masayume from "../addresses.masayume.json";
import { SOMNIA_SHANNON_ID } from "../chain";
import type { MarketsEnv } from "../env";

interface Record {
  rangeReserve?: string;
  rangeReserveFromBlock?: number | string;
}

const DEPLOYMENTS = (masayume as { deployments: globalThis.Record<string, Record> }).deployments;

/**
 * Where the RangeReserve lives for the configured chain, or null when it is not deployed there. The
 * generated module is the source of truth (AD-10 lockstep); an env override exists for a local fork.
 */
export function resolveRangeDeployment(env: Partial<Pick<MarketsEnv, "chainId" | "rangeReserveAddress" | "rangeReserveFromBlock">> = {}): RangeDeployment | null {
  const chainId = env.chainId ?? SOMNIA_SHANNON_ID;
  const record = DEPLOYMENTS[String(chainId)];
  const rangeReserve = (env.rangeReserveAddress ?? record?.rangeReserve) as Address | undefined;
  if (!rangeReserve) return null;
  const fromBlock = env.rangeReserveFromBlock ?? (record?.rangeReserveFromBlock !== undefined ? BigInt(record.rangeReserveFromBlock) : 0n);
  return { chainId, rangeReserve, fromBlock };
}
