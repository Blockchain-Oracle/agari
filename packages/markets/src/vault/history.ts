import { ledgerHasActivity, settleRound, type MarketLedger, type RoundMarket, type SettledRound } from "@agari/core/projection";
import { encodeBase58, type Address, type MarketId, type Signature } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { readMarket, readSeries } from "../runtime/accounts";
import { getVaultDeployment } from "../runtime/read-runtime";
import { ANY_MARKET, readVaultAccount } from "./accounts";

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

/**
 * Every Window the wallet holds through the vault right now, read from its own account's position slots.
 *
 * The EVM original rebuilt this from an event scan, which is why it carries a `complete` flag. On Solana the vault
 * keeps each owner's open positions in their `VaultAccount` (16 slots; a settled or sold-out slot is freed), so the
 * list of what is still held is complete by construction and needs no scan. It answered `complete: false` with an
 * empty list from the day the vault deployed, which held the strategy runner after its first cycle forever.
 *
 * What a slot does not record is what the position cost: the program keeps lots and the grant that opened them,
 * not cash. `costBase` is therefore 0 here and means "not recorded", which the open-bets row shows as no stake
 * line rather than a stake of zero. A closed round is not here at all; that history needs the vault's events indexed.
 */
export async function listVaultTallies(wallet: Address, _options: { complete?: boolean } = {}): Promise<VaultTallies> {
  if (!getVaultDeployment()) return { tallies: [], complete: true };
  const account = await readVaultAccount(wallet);
  if (!account) return { tallies: [], complete: true };
  const held = account.positions.filter((slot) => (slot.market as string) !== ANY_MARKET && slot.yesLots + slot.noLots > 0n);
  const tallies = await Promise.all(held.map(async (slot): Promise<VaultTally | null> => {
    const market = await readMarket(slot.market);
    if (!market) return null;
    const { lotBase } = await readSeries(market.data.series);
    return {
      marketId: slot.market as string as MarketId,
      costBase: 0n,
      proceedsBase: 0n,
      payoutBase: 0n,
      boughtUpRaw: slot.yesLots * lotBase,
      boughtDownRaw: slot.noLots * lotBase,
      soldUpRaw: 0n,
      soldDownRaw: 0n,
      firstAtSec: 0,
      lastAtSec: 0,
      settledAtSec: 0,
      fillCount: 1,
    };
  }));
  // A slot whose Market the engine has already closed can no longer be settled by anyone, so it is not owed a crank.
  return { tallies: tallies.filter((tally): tally is VaultTally => tally !== null), complete: true };
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
