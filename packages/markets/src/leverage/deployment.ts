import type { LeverageDeployment } from "@masayume/core/leverage";
import type { Address } from "@masayume/core/types";
import masayume from "../addresses.masayume.json";
import { SOMNIA_SHANNON_ID } from "../chain";
import type { MarketsEnv } from "../env";

interface Record {
  leverageReserve?: string;
  leverageReserveFromBlock?: number | string;
}

const DEPLOYMENTS = (masayume as { deployments: globalThis.Record<string, Record> }).deployments;

/** Where the LeverageReserve lives for the configured chain, or null when it is not deployed there (AD-10 lockstep; the env override is for a local fork). */
export function resolveLeverageDeployment(env: Partial<Pick<MarketsEnv, "chainId" | "leverageReserveAddress" | "leverageReserveFromBlock">> = {}): LeverageDeployment | null {
  const chainId = env.chainId ?? SOMNIA_SHANNON_ID;
  const record = DEPLOYMENTS[String(chainId)];
  const leverageReserve = (env.leverageReserveAddress ?? record?.leverageReserve) as Address | undefined;
  if (!leverageReserve) return null;
  const fromBlock = env.leverageReserveFromBlock ?? (record?.leverageReserveFromBlock !== undefined ? BigInt(record.leverageReserveFromBlock) : 0n);
  return { chainId, leverageReserve, fromBlock };
}
