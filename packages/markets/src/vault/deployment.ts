import type { Address } from "@masayume/core/types";
import type { VaultDeployment } from "@masayume/core/vault";
import type { MarketsEnv } from "../env";
import { resolveAddresses } from "../addresses";
import masayume from "../addresses.masayume.json";

interface DeploymentRecord {
  eventVault: string;
  forwarder: string;
  collateral: string;
  fromBlock: number | string;
}

const DEPLOYMENTS = (masayume as { deployments: Record<string, DeploymentRecord> }).deployments;

/**
 * Where the EventVault lives for the configured chain, or null when it is not deployed there.
 *
 * The generated module (`contracts/export.mjs`) is the source of truth (AD-10 lockstep); an env
 * override exists for a local fork, never for production.
 */
export function resolveVaultDeployment(env: Pick<MarketsEnv, "chainId" | "eventVaultAddress" | "forwarderAddress" | "eventVaultFromBlock">): VaultDeployment | null {
  const record = DEPLOYMENTS[String(env.chainId)];
  const eventVault = (env.eventVaultAddress ?? record?.eventVault) as Address | undefined;
  const forwarder = (env.forwarderAddress ?? record?.forwarder) as Address | undefined;
  if (!eventVault || !forwarder) return null;
  const fromBlock = env.eventVaultFromBlock ?? (record ? BigInt(record.fromBlock) : 0n);
  // An env override has no record; the venue's collateral is the vault's collateral by construction.
  const collateral = (record?.collateral ?? resolveAddresses().collateral ?? "") as Address;
  return { chainId: env.chainId, eventVault, forwarder, collateral, fromBlock };
}
