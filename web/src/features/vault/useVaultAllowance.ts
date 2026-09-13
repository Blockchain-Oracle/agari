"use client";

import type { Reading } from "@masayume/core/schemas";
import type { Address } from "@masayume/core/types";
import type { VaultDeployment } from "@masayume/core/vault";
import { getClient, getCollateral, withReading } from "@masayume/markets";
import { useReadingQuery } from "@masayume/markets/react";

const allowanceKey = (wallet: string | null, vault: string | null) => ["masayume", "vault-allowance", wallet, vault] as const;

function readAllowance(wallet: Address, vault: Address): Promise<Reading<bigint>> {
  return withReading(`vault-allowance:${wallet}`, () => getClient().getErc20Allowance(getCollateral().address, wallet, vault));
}

/**
 * Whether the vault still needs the wallet's ERC-20 allowance. The deposit lane absorbs the
 * approval itself; this only decides whether to say "two signatures this first time" beforehand,
 * so an unknown allowance is treated as "not short" rather than shown as a warning it cannot back.
 */
export function useVaultAllowance(wallet: Address | null, deployment: VaultDeployment | null): boolean {
  const reading = useReadingQuery(allowanceKey(wallet, deployment?.eventVault ?? null), () => readAllowance(wallet as Address, deployment?.eventVault as Address), {
    enabled: wallet !== null && deployment !== null,
  });
  return reading !== null && reading.ok && reading.value === 0n;
}
