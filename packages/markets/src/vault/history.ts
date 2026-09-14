import { ledgerHasActivity, settleRound, type MarketLedger, type RoundMarket, type SettledRound } from "@agari/core/projection";
import { encodeBase58, type Address, type MarketId, type Signature } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { getVaultDeployment } from "../runtime/read-runtime";

/** A vault round has no single transaction to link: the fills are the vault seat's, attributed by tally. */
export const VAULT_TX_SENTINEL = encodeBase58(new Uint8Array(64)) as Signature;

export interface VaultTally {
  marketId: MarketId;
  costBase: bigint;
  proceedsBase: bigint;
  payoutBase: bigint;
  boughtUpRaw: bigint;
  boughtDownRaw: bigint;
  soldUpRaw: bigint;
  soldDownRaw: bigint;
  firstAtSec: number;
  lastAtSec: number;
  settledAtSec: number;
  fillCount: number;
}

export interface VaultTallies {
  tallies: VaultTally[];
  complete: boolean;
}

/** Every Window the wallet traded through the vault, with its tally — the vault's own record. Empty until S7. */
export async function listVaultTallies(_wallet: Address, _options: { complete?: boolean } = {}): Promise<VaultTallies> {
  if (!getVaultDeployment()) return { tallies: [], complete: true };
  return { tallies: [], complete: false };
}

/** The vault never shorts (a sale needs inventory), so held is simply bought minus sold per side. */
export function tallyToLedger(t: VaultTally): MarketLedger {
  const sidesTraded: MarketLedger["sidesTraded"] = [];
  if (t.boughtUpRaw > 0n) sidesTraded.push(0);
  if (t.boughtDownRaw > 0n) sidesTraded.push(1);
  return {
    marketId: t.marketId,
    heldUpRaw: t.boughtUpRaw - t.soldUpRaw,
    heldDownRaw: t.boughtDownRaw - t.soldDownRaw,
    costBase: t.costBase,
    proceedsBase: t.proceedsBase,
    sidesTraded,
    fillCount: t.fillCount,
    shortCount: 0,
    firstAtMs: secToMs(t.firstAtSec),
    lastAtMs: secToMs(t.lastAtSec),
    entryTxHash: VAULT_TX_SENTINEL,
    source: "vault",
  };
}

/**
 * A settled vault round. A cranked Window has been paid into the Trading Balance, so its live
 * holdings are zero; an uncranked one still holds its tokens in the vault — `to-collect` here
 * means "crank it", and anyone may.
 */
export function vaultRound(t: VaultTally, market: RoundMarket, feeBps: number): SettledRound | null {
  const ledger = tallyToLedger(t);
  if (!ledgerHasActivity(ledger)) return null;
  const cranked = t.settledAtSec > 0;
  const liveHoldings = cranked ? { upRaw: 0n, downRaw: 0n } : { upRaw: ledger.heldUpRaw, downRaw: ledger.heldDownRaw };
  return settleRound({ ledger, market, feeBps, liveHoldings, source: "vault" });
}
