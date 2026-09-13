"use client";

import { isOk } from "@masayume/core/schemas";
import type { VenueCredit } from "@masayume/core/types";
import type { VaultDeployment } from "@masayume/core/vault";
import { useBalanceSheet } from "@masayume/markets/react";

/**
 * The vault's own venue credit, per pool — the balance sheet read for the vault's address. A
 * refund that lands as pool credit is the vault's cash but not its wallet balance, so a
 * withdrawal could need it swept back first; this is what tells the panel to offer that.
 */
export function useVaultPoolCredit(deployment: VaultDeployment | null): VenueCredit[] {
  const sheet = useBalanceSheet(deployment?.eventVault ?? null);
  if (!deployment || !sheet || !isOk(sheet)) return [];
  return sheet.value.venueCreditByPool;
}
