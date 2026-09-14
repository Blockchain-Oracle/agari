import { ensureMarkets, loadCollateral, unwrap } from "@agari/markets";
import { createDeskClient, type DeskClient } from "@agari/markets/private";
import { parseSecretKey } from "@agari/markets/sessions";
import { webEnv } from "@/lib/env";

/**
 * The desk's server half — the web-hosted form of the reference's private-bet executor. One key from
 * `PRIVATE_DESK_PRIVATE_KEY` (a 64-byte Solana keypair: CLI JSON array or base58), held only here; the browser never
 * learns it. Nothing is stored: every open and cash-out resumes from what the chain shows (S10).
 */
let desk: DeskClient | null | undefined;
let collateralLoaded: Promise<void> | null = null;

export async function getDesk(): Promise<DeskClient | null> {
  ensureMarkets(webEnv.markets);
  if (!collateralLoaded) collateralLoaded = loadCollateral().then((r) => void unwrap(r));
  await collateralLoaded;
  if (desk !== undefined) return desk;
  const raw = process.env.PRIVATE_DESK_PRIVATE_KEY;
  let secretKey: Uint8Array | null = null;
  try {
    secretKey = raw ? parseSecretKey(raw) : null;
  } catch {
    secretKey = null;
  }
  desk = secretKey ? createDeskClient({ secretKey, rpcUrl: process.env.PRIVATE_DESK_RPC_URL || (webEnv.markets.rpcHttpUrls[0] as string) }) : null;
  return desk;
}
