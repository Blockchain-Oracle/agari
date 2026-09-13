import type { Address } from "@masayume/core/types";
import type { RegistryDeployment } from "@masayume/core/strategies";
import masayume from "../addresses.masayume.json";
import { SOMNIA_SHANNON_ID } from "../chain";

interface Record {
  strategyRegistry?: string;
  strategyRegistryFromBlock?: number | string;
}

const DEPLOYMENTS = (masayume as { deployments: globalThis.Record<string, Record> }).deployments;

/**
 * Where the StrategyRegistry lives for the configured chain, or null when it is not deployed there.
 * The generated module is the only source (AD-10 lockstep); `contracts/export.mjs` merges the
 * registry's keys into the same per-chain record as the vault's.
 */
export function resolveRegistryDeployment(chainId: number = SOMNIA_SHANNON_ID): RegistryDeployment | null {
  const record = DEPLOYMENTS[String(chainId)];
  if (!record?.strategyRegistry) return null;
  return { chainId, strategyRegistry: record.strategyRegistry as Address, fromBlock: BigInt(record.strategyRegistryFromBlock ?? 0) };
}
