"use client";

import { MARKETS_POLL_MS } from "@masayume/core/constants";
import type { Reading } from "@masayume/core/schemas";
import { type Address, type IndexedStatus, type MarketId } from "@masayume/core/types";
import { listVaultTallies, marketsProvider, tallyToLedger, withReading } from "@masayume/markets";
import { useReadingQuery } from "@masayume/markets/react";
import type { QueryClient } from "@tanstack/react-query";

/** One open Window the vault holds for the wallet: what it holds and what it cost, never a mark it cannot read. */
export interface VaultOpenBet {
  marketId: MarketId;
  asset: string;
  intervalSec: number;
  expirySec: number;
  decimals: number;
  heldUpRaw: bigint;
  heldDownRaw: bigint;
  /** Cost of what is still held, net of anything sold back — at cost, because the venue does not price the vault's tokens per owner. */
  stakeBase: bigint;
}

const SETTLED: ReadonlySet<IndexedStatus> = new Set<IndexedStatus>(["Resolved", "Voided", "Finalized"]);

export const vaultOpenBetsKey = (wallet: string | null) => ["masayume", "vault-open-bets", wallet] as const;

export async function listVaultOpenBets(wallet: Address): Promise<Reading<VaultOpenBet[]>> {
  return withReading(`vault-open-bets:${wallet}`, async (inner) => {
    const { tallies } = await listVaultTallies(wallet);
    const open = tallies.map(tallyToLedger).filter((ledger) => ledger.heldUpRaw + ledger.heldDownRaw > 0n);
    const rows = await Promise.all(
      open.map(async (ledger) => {
        const market = inner(await marketsProvider.getMarket(ledger.marketId));
        if (!market || SETTLED.has(market.status)) return null;
        return {
          marketId: ledger.marketId,
          asset: market.asset,
          intervalSec: market.intervalSec,
          expirySec: market.expirySec,
          decimals: market.decimals,
          heldUpRaw: ledger.heldUpRaw,
          heldDownRaw: ledger.heldDownRaw,
          stakeBase: ledger.costBase > ledger.proceedsBase ? ledger.costBase - ledger.proceedsBase : 0n,
        } satisfies VaultOpenBet;
      }),
    );
    return rows.filter((row): row is VaultOpenBet => row !== null).sort((a, b) => a.expirySec - b.expirySec);
  });
}

/** Open Windows the vault holds for the wallet; an empty list where no vault is deployed, never an error. */
export function useVaultOpenBets(wallet: Address | null): Reading<VaultOpenBet[]> | null {
  return useReadingQuery(vaultOpenBetsKey(wallet), () => listVaultOpenBets(wallet as Address), { pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

export function invalidateVaultOpenBets(queryClient: QueryClient, wallet: Address): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: vaultOpenBetsKey(wallet) });
}
