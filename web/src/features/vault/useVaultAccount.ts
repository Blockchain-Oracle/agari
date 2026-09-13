"use client";

import { isOk, type Reading } from "@masayume/core/schemas";
import type { Address } from "@masayume/core/types";
import type { VaultGrant, VaultSnapshot } from "@masayume/core/vault";
import { keys, useBalanceSheet, useVaultSnapshot } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { useVenue } from "../markets/useVenue";

export type VaultAccountState =
  | { kind: "disconnected" }
  | {
      kind: "connected";
      address: Address;
      reading: Reading<VaultSnapshot | null> | null;
      symbol: string | null;
      /** The wallet's spendable collateral — what a deposit can draw on; null until the sheet answers. */
      walletSpendableBase: bigint | null;
      retry: () => void;
    };

/** The three live grants as a list, oldest kind first — an owner holds at most one per kind. */
export function liveGrants(snapshot: VaultSnapshot): VaultGrant[] {
  return [snapshot.grants.session, snapshot.grants.executor, snapshot.grants.strategy].filter((g): g is VaultGrant => g !== null);
}

export function grantsBudgetBase(snapshot: VaultSnapshot): bigint {
  return liveGrants(snapshot).reduce((sum, g) => sum + g.budgetBase, 0n);
}

/** The connected wallet's Trading Balance reading plus the wallet-side facts the controls need. */
export function useVaultAccount(): VaultAccountState {
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : null;
  const reading = useVaultSnapshot(address);
  const sheet = useBalanceSheet(address);
  const queryClient = useQueryClient();
  const retry = useCallback(() => {
    if (address) void queryClient.invalidateQueries({ queryKey: keys.vault(address) });
  }, [address, queryClient]);

  if (!address) return { kind: "disconnected" };
  const walletSpendableBase = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  return { kind: "connected", address, reading, symbol, walletSpendableBase, retry };
}
