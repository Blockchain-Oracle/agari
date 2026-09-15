import type { MarketId } from "../types/market";
import type { Address } from "../types/primitives";

/** The three delegated powers (AD-5), in the contract's enum order. */
export type GrantKind = "session" | "executor" | "strategy";
export const GRANT_KINDS: readonly GrantKind[] = ["session", "executor", "strategy"];
export const GRANT_KIND_INDEX: Record<GrantKind, 0 | 1 | 2> = { session: 0, executor: 1, strategy: 2 };

export function grantKindOf(index: number): GrantKind {
  const kind = GRANT_KINDS[index];
  if (!kind) throw new Error(`unknown grant kind ${index}`);
  return kind;
}

/** Every cap in collateral base units except the position count; `maxPriceRaw` 0 means no limit. */
export interface VaultCaps {
  maxStakePerTradeBase: bigint;
  maxDailySpendBase: bigint;
  maxOpenPositions: number;
  maxPriceRaw: bigint;
}

export interface VaultGrant {
  grantId: bigint;
  owner: Address;
  actor: Address;
  kind: GrantKind;
  revoked: boolean;
  expiresAtSec: number;
  /** UTC day (`sec / 86400`) that `spentTodayBase` belongs to. */
  spentDay: number;
  spentTodayBase: bigint;
  openPositions: number;
  caps: VaultCaps;
  /** What the actor may still spend; proceeds never return here. */
  budgetBase: bigint;
}

export interface VaultAccount {
  availableBase: bigint;
  privateAvailableBase: bigint;
  totalDepositedBase: bigint;
  totalWithdrawnBase: bigint;
}

/** Where `agari-vault` lives on one cluster (vault.md §1, D-069). There is no forwarder: the sponsor only pays fees. */
export interface VaultDeployment {
  chainId: number;
  /** The agari-vault program id (`NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID` = `addresses.devnet.json` `programs.agari_vault`). */
  eventVault: Address;
  /** The `["seat"]` PDA: the vault's PROGRAM seat in every Ledger and the authority of each owner's custody. */
  seat: Address;
  /** The `["vault-config"]` PDA. */
  config: Address;
  collateral: Address;
  /** The slot the vault was deployed in: where its event history starts. */
  fromBlock: bigint;
}

/** One reading of everything the Trading Balance surfaces show for a wallet. */
export interface VaultSnapshot {
  deployment: VaultDeployment;
  account: VaultAccount;
  /** The live grant per kind, or null — an owner holds at most one per kind. */
  grants: Record<GrantKind, VaultGrant | null>;
  decimals: number;
}

/** Outcome tokens the vault holds for the wallet on one Window, and which grant opened each side. */
export interface VaultHoldings {
  marketId: MarketId;
  upRaw: bigint;
  downRaw: bigint;
  upGrantId: bigint;
  downGrantId: bigint;
}

export const VAULT_NOT_DEPLOYED = "agari-vault is not deployed on this cluster yet" as const;
