import { MARKETS_POLL_MS } from "@masayume/core/constants";
import type { Reading } from "@masayume/core/schemas";
import type { Address, Holdings, OnchainSnapshot } from "@masayume/core/types";
import { getHoldings } from "../provider/positions";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";

/** Authoritative ERC-6909 balances for one market generation; the snapshot supplies the token and ids, so a recycled pool never bleeds through. */
export function useHoldings(wallet: Address | null, onchain: OnchainSnapshot | null, pollMs: number | false = MARKETS_POLL_MS): Reading<Holdings> | null {
  return useReadingQuery(keys.holdings(wallet, onchain?.marketId ?? null), () => getHoldings(wallet as Address, onchain as OnchainSnapshot), {
    enabled: wallet !== null && onchain !== null,
    pollMs: pollMs || undefined,
  });
}
