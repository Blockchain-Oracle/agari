import type { Hex } from "@masayume/core/types";
import { ensureMarkets, loadCollateral, unwrap } from "@masayume/markets";
import { createDeskClient, type DeskClient } from "@masayume/markets/private";
import { webEnv } from "@/lib/env";

/**
 * The desk's server half — the web-hosted form of the reference's private-bet executor. One key from
 * `PRIVATE_DESK_PRIVATE_KEY`, held only here; the browser never learns it. Nothing is stored: every open
 * and cash-out resumes from what the contract shows.
 */
let desk: DeskClient | null | undefined;
let collateralLoaded: Promise<void> | null = null;

export async function getDesk(): Promise<DeskClient | null> {
  ensureMarkets(webEnv.markets);
  if (!collateralLoaded) collateralLoaded = loadCollateral().then((r) => void unwrap(r));
  await collateralLoaded;
  if (desk !== undefined) return desk;
  const raw = process.env.PRIVATE_DESK_PRIVATE_KEY;
  if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    desk = null;
    return null;
  }
  desk = createDeskClient({ privateKey: raw as Hex, rpcUrl: process.env.PRIVATE_DESK_RPC_URL || (webEnv.markets.rpcHttpUrls[0] as string) });
  return desk;
}
