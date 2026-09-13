"use client";

import { isOk } from "@masayume/core/schemas";
import type { ListItem } from "@/lib/use-pager";
import { useWalletSession } from "@/lib/wallet-session";
import { useChainNowMs } from "../markets/useChainNow";
import { useVaultOpenBets } from "./useVaultOpenBets";
import { VaultBetRow } from "./VaultBetRow";

const NONE: readonly ListItem[] = [];

/**
 * Open Windows the vault holds for the connected wallet, as rows for the portfolio's Open tab — the
 * tab owns the list and its pages, so this returns items rather than a section. Empty without a vault
 * or without positions; the wallet's panel already carries the empty state.
 */
export function useVaultBetItems(symbol: string | undefined): readonly ListItem[] {
  const { address } = useWalletSession();
  const nowMs = useChainNowMs();
  const reading = useVaultOpenBets(address);
  if (!reading || !isOk(reading) || reading.value.length === 0) return NONE;
  return reading.value.map((bet) => ({ key: `vault:${bet.marketId}`, node: <VaultBetRow bet={bet} symbol={symbol} nowMs={nowMs} /> }));
}
