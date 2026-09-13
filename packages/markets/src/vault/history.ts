import { ledgerHasActivity, settleRound, type MarketLedger, type RoundMarket, type SettledRound } from "@masayume/core/projection";
import { toMarketId, type Address, type Hex, type MarketId } from "@masayume/core/types";
import { secToMs } from "@masayume/core/units";
import type { PublicClient } from "viem";
import { MULTICALL3_ADDRESS } from "../chain";
import { eventVaultAbi } from "../contracts/event-vault.abi";
import { getClient, getVaultDeployment } from "../runtime/read-runtime";

const PAGE = 200;
const MAX_MARKETS = 1_000;
const MULTICALL_CHUNK = 100;
/** A vault round has no single transaction to link: the fills are the vault's, attributed by tally. */
export const VAULT_TX_SENTINEL = `0x${"0".repeat(64)}` as Hex;

type Tally = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, number];

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

function toTally(marketId: MarketId, t: Tally): VaultTally {
  return {
    marketId,
    costBase: t[0],
    proceedsBase: t[1],
    payoutBase: t[2],
    boughtUpRaw: t[3],
    boughtDownRaw: t[4],
    soldUpRaw: t[5],
    soldDownRaw: t[6],
    firstAtSec: Number(t[7]),
    lastAtSec: Number(t[8]),
    settledAtSec: Number(t[9]),
    fillCount: t[10],
  };
}

/** Every Window the wallet traded through the vault, with its tally — the vault's own record, no events replayed. */
export async function listVaultTallies(wallet: Address, options: { complete?: boolean } = {}): Promise<VaultTallies> {
  const deployment = getVaultDeployment();
  if (!deployment) return { tallies: [], complete: true };
  const client = getClient().getViemClient() as PublicClient;
  const contract = { address: deployment.eventVault, abi: eventVaultAbi } as const;
  const count = Number(await client.readContract({ ...contract, functionName: "marketCountOf", args: [wallet] }));
  const wanted = options.complete ? count : Math.min(count, MAX_MARKETS);
  const ids: MarketId[] = [];
  for (let offset = 0; offset < wanted; offset += PAGE) {
    const page = await client.readContract({ ...contract, functionName: "marketsOf", args: [wallet, BigInt(offset), BigInt(Math.min(PAGE, wanted - offset))] });
    ids.push(...page.map((id) => toMarketId(id)));
  }
  const tallies: VaultTally[] = [];
  for (let i = 0; i < ids.length; i += MULTICALL_CHUNK) {
    const chunk = ids.slice(i, i + MULTICALL_CHUNK);
    const rows = await client.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: chunk.map((id) => ({ ...contract, functionName: "tallyOf", args: [wallet, id] }) as const),
    });
    rows.forEach((row, j) => tallies.push(toTally(chunk[j] as MarketId, row as Tally)));
  }
  return { tallies, complete: wanted === count };
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
