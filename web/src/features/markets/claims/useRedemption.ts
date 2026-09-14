"use client";

import { ONCHAIN_POLL_MS } from "@agari/core/constants";
import { err, ok, type Reading } from "@agari/core/schemas";
import { diagnosis, toSignature, type Address, type MarketId, type Signature } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { keys, useReadingQuery } from "@agari/markets/react";
import { z } from "zod";
import { webEnv } from "@/lib/env";

/** A Window's redemption for one wallet: who sent it and the transaction that paid it. */
export interface Redemption {
  txHash: Signature;
  /** True when the settler's `redeem_for` paid the seat after the claim grace (D-032), not the wallet's own claim. */
  byCrank: boolean;
}

/** `/api/index/wallet/:w/actions` rows (first-call.md §5): `Redeemed` carries the event body as `data`. */
const actionsSchema = z.object({
  rows: z.array(z.object({ signature: z.string(), name: z.string(), market: z.string(), data: z.object({ byCrank: z.boolean().optional() }).passthrough() })),
});

/** A wallet redeems a Window once (a full redeem), so the newest 200 actions reach any Window still on screen. */
const ACTIONS_LIMIT = 200;

async function readRedemption(wallet: Address, marketId: MarketId): Promise<Reading<Redemption | null>> {
  const base = webEnv.markets.indexerUrl;
  if (!base) return err(diagnosis("indexer-down", "NEXT_PUBLIC_AGARI_INDEXER_URL is not set; redemptions are read from the index"));
  const response = await fetch(`${base}/wallet/${wallet}/actions?limit=${ACTIONS_LIMIT}`, { cache: "no-store" });
  if (!response.ok) return err(diagnosis("indexer-down", `index actions answered ${response.status}`));
  const { rows } = actionsSchema.parse(await response.json());
  const row = rows.find((action) => action.name === "Redeemed" && action.market === marketId);
  return ok(row ? { txHash: toSignature(row.signature), byCrank: row.data.byCrank === true } : null, marketsProvider.nowMs());
}

/**
 * How a won Window's payout reached the wallet once nothing is left to claim: the wallet's own redeem, or the
 * venue paying it automatically. Nested under the wallet's positions, so the claim that empties a seat refreshes it.
 * An index that lags a few seconds answers null first; the verdict then says "Paid to your wallet" until it lands.
 */
export function useRedemption(wallet: Address | null, marketId: MarketId, enabled: boolean): Redemption | null {
  const reading = useReadingQuery([...keys.positions(wallet), "redemption", marketId], () => readRedemption(wallet as Address, marketId), {
    enabled: enabled && wallet !== null,
    pollMs: (latest) => (latest?.ok && latest.value ? false : ONCHAIN_POLL_MS),
    needs: [],
  });
  return reading?.ok ? reading.value : null;
}
