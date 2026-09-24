"use client";

import { MARKETS_POLL_MS } from "@agari/core/constants";
import type { TickerSymbol } from "@agari/core/market";
import type { Reading } from "@agari/core/schemas";
import { type Address, type IndexedStatus, type MarketId } from "@agari/core/types";
import { getMarketsLite, listVaultTallies, tallyToLedger, withReading } from "@agari/markets";
import { useReadingQuery } from "@agari/markets/react";
import type { QueryClient } from "@tanstack/react-query";

/** One open Window the vault holds for the wallet: what it holds and what it cost, never a mark it cannot read. */
export interface VaultOpenBet {
  marketId: MarketId;
  asset: TickerSymbol;
  intervalSec: number;
  expirySec: number;
  decimals: number;
  heldUpRaw: bigint;
  heldDownRaw: bigint;
  /** Cost of what is still held, net of anything sold back — at cost, because the venue does not price the vault's tokens per owner. */
  stakeBase: bigint | null;
}

const SETTLED: ReadonlySet<IndexedStatus> = new Set<IndexedStatus>(["Resolved", "Voided", "Finalized"]);

/** In the markets family, so the persisted read cache can keep it with the wallet's other open bets. */
export const vaultOpenBetsKey = (wallet: string | null) => ["agari", "markets", "vaultOpenBets", wallet] as const;

export async function listVaultOpenBets(wallet: Address): Promise<Reading<VaultOpenBet[]>> {
  return withReading(`vault-open-bets:${wallet}`, async (inner) => {
    const { tallies } = await listVaultTallies(wallet);
    const open = tallies.map(tallyToLedger).filter((ledger) => ledger.heldUpRaw + ledger.heldDownRaw > 0n);
    if (open.length === 0) return [];
    // One index query for every held Window, not one per Window.
    const markets = inner(await getMarketsLite(open.map((ledger) => ledger.marketId)));
    const rows = open.map((ledger) => {
      const market = markets.get(ledger.marketId);
      if (!market || SETTLED.has(market.status)) return null;
      return {
        marketId: ledger.marketId,
        asset: market.asset,
        intervalSec: market.intervalSec,
        expirySec: market.expirySec,
        decimals: market.decimals,
        heldUpRaw: ledger.heldUpRaw,
        heldDownRaw: ledger.heldDownRaw,
        // The vault's position slots record lots, not cash, so a cost of 0 means "not recorded", never "free".
        stakeBase: ledger.costBase > ledger.proceedsBase ? ledger.costBase - ledger.proceedsBase : null,
      } satisfies VaultOpenBet;
    });
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
