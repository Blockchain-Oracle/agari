import type { PrivateDeployment } from "@masayume/core/private";
import type { Address } from "@masayume/core/types";
import masayume from "../addresses.masayume.json";
import { SOMNIA_SHANNON_ID } from "../chain";
import type { MarketsEnv } from "../env";

interface Record {
  privateDesk?: string;
  privateDeskFromBlock?: number | string;
}

const DEPLOYMENTS = (masayume as { deployments: globalThis.Record<string, Record> }).deployments;

/** Where the PrivateDesk lives for the configured chain, or null when it is not deployed there (AD-10 lockstep; the env override is for a local fork). */
export function resolvePrivateDeployment(env: Partial<Pick<MarketsEnv, "chainId" | "privateDeskAddress" | "privateDeskFromBlock">> = {}): PrivateDeployment | null {
  const chainId = env.chainId ?? SOMNIA_SHANNON_ID;
  const record = DEPLOYMENTS[String(chainId)];
  const privateDesk = (env.privateDeskAddress ?? record?.privateDesk) as Address | undefined;
  if (!privateDesk) return null;
  const fromBlock = env.privateDeskFromBlock ?? (record?.privateDeskFromBlock !== undefined ? BigInt(record.privateDeskFromBlock) : 0n);
  return { chainId, privateDesk, fromBlock };
}
