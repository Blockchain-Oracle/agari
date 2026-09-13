import type { MakerDeployment } from "@masayume/core/maker";
import type { Address } from "@masayume/core/types";
import masayume from "../addresses.masayume.json";
import { SOMNIA_SHANNON_ID } from "../chain";
import type { MarketsEnv } from "../env";

interface Record {
  marketMakerVault?: string;
  marketMakerVaultFromBlock?: number | string;
}

const DEPLOYMENTS = (masayume as { deployments: globalThis.Record<string, Record> }).deployments;

/** Where the MarketMakerVault lives for the configured chain, or null when it is not deployed there (AD-10 lockstep). */
export function resolveMakerDeployment(env: Partial<Pick<MarketsEnv, "chainId" | "marketMakerVaultAddress" | "marketMakerVaultFromBlock">> = {}): MakerDeployment | null {
  const chainId = env.chainId ?? SOMNIA_SHANNON_ID;
  const record = DEPLOYMENTS[String(chainId)];
  const marketMakerVault = (env.marketMakerVaultAddress ?? record?.marketMakerVault) as Address | undefined;
  if (!marketMakerVault) return null;
  const fromBlock = env.marketMakerVaultFromBlock ?? (record?.marketMakerVaultFromBlock !== undefined ? BigInt(record.marketMakerVaultFromBlock) : 0n);
  return { chainId, marketMakerVault, fromBlock };
}
