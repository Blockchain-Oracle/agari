"use client";

import { isOk, type Reading } from "@masayume/core/schemas";
import type { Address, BalanceSheet } from "@masayume/core/types";
import { keys, useBalanceSheet } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { useVenue } from "../useVenue";

export type BalancePlateState =
  | { kind: "disconnected"; symbol: string | null }
  | { kind: "connected"; address: Address; symbol: string | null; reading: Reading<BalanceSheet> | null; retry: () => void };

/** Balance sheet for the connected wallet; the collateral symbol comes from the boot read, never a guessed ticker. */
export function useBalancePlate(): BalancePlateState {
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : null;
  const reading = useBalanceSheet(address);
  const queryClient = useQueryClient();
  const retry = useCallback(() => {
    if (address) void queryClient.invalidateQueries({ queryKey: keys.balanceSheet(address) });
  }, [address, queryClient]);

  if (!address) return { kind: "disconnected", symbol };
  return { kind: "connected", address, symbol, reading, retry };
}
