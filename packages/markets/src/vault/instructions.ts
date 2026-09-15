/**
 * agari-vault instruction builders (vault.md §3). Builders only: the lanes plan from chain reads, then build, simulate
 * and sign. Every vault instruction carries the vault's own `#[event_cpi]` pair; the trading and settle instructions
 * also carry the engine block of one Window, read from its Market. Amounts are integers in base units; a price cap
 * that is not a whole number of ticks is refused here rather than truncated (vault.md §2 "Units").
 */
import {
  AGARI_VAULT_PROGRAM_ADDRESS,
  getActorPlaceForInstructionAsync,
  getOwnerDepositAndGrantInstructionAsync,
  getOwnerDepositInstructionAsync,
  getOwnerFundGrantInstructionAsync,
  getOwnerGrantInstructionAsync,
  getOwnerMoveToPrivateInstructionAsync,
  getOwnerOpenAccountInstructionAsync,
  getOwnerPlaceInstructionAsync,
  getOwnerRevokeInstructionAsync,
  getOwnerWithdrawInstructionAsync,
  getOwnerWithdrawPrivateInstructionAsync,
  getPublicCrankSettleInstructionAsync,
  type CapsArgsArgs,
} from "@agari/clients/agari-vault";
import type { GrantTerms } from "@agari/core/ports";
import { GRANT_KIND_INDEX } from "@agari/core/vault";
import type { Address, Instruction, TransactionSigner } from "@solana/kit";
import type { MarketAccount } from "../runtime/mappers";
import { ANY_MARKET, grantAddress, NO_GRANT, vaultEventAuthority } from "./accounts";

const U32_MAX = 0xffff_ffff;

/** One Window's engine accounts as the vault passes them through (vault.md §3 "ENG"). */
export interface EngineBlock {
  series: Address;
  market: Address;
  book: Address;
  ledger: Address;
  mvault: Address;
  collateralMint: Address;
}

export function engineBlockOf(market: MarketAccount, collateralMint: Address): EngineBlock {
  const { data } = market;
  return { series: data.series, market: market.address, book: data.book, ledger: data.ledger, mvault: data.mvault, collateralMint };
}

const emit = async () => ({ eventAuthority: await vaultEventAuthority(), program: AGARI_VAULT_PROGRAM_ADDRESS });

/** Port caps → `CapsArgs`: base units as they are, the price cap in own-side ticks (`maxPriceRaw / tick_base`, exact), the Window scope or any (D-091). */
export function capsArgsOf(terms: Pick<GrantTerms, "caps">, tickBase: bigint): CapsArgsArgs {
  const { caps } = terms;
  if (tickBase <= 0n || caps.maxPriceRaw % tickBase !== 0n) throw new Error(`price cap ${caps.maxPriceRaw} is not a whole number of ${tickBase}-unit ticks`);
  // An exact integer tick count (≤ 999), never a float.
  const capTicks = caps.maxPriceRaw / tickBase;
  if (capTicks > 999n) throw new Error(`price cap ${capTicks} ticks is above 999`);
  if (!Number.isInteger(caps.maxOpenPositions) || caps.maxOpenPositions < 0 || caps.maxOpenPositions > U32_MAX) {
    throw new Error(`position cap ${caps.maxOpenPositions} is not a u32`);
  }
  const market = caps.market === undefined ? ANY_MARKET : (caps.market as string as Address);
  return { maxStakePerTrade: caps.maxStakePerTradeBase, maxDailySpend: caps.maxDailySpendBase, maxOpenPositions: caps.maxOpenPositions, maxPriceTicks: Number(capTicks), market };
}

export async function openAccountIx(owner: TransactionSigner, collateralMint: Address): Promise<Instruction> {
  return getOwnerOpenAccountInstructionAsync({ owner, collateralMint, ...(await emit()) });
}

export async function depositIx(owner: TransactionSigner, ownerAta: Address, collateralMint: Address, amount: bigint): Promise<Instruction> {
  return getOwnerDepositInstructionAsync({ owner, ownerAta, collateralMint, amount, ...(await emit()) });
}

export interface GrantInput {
  grantId: bigint;
  terms: GrantTerms;
  tickBase: bigint;
  /** The owner's active grant of this kind (revoked first, budget back), or 0 when there is none. */
  previousGrantId: bigint;
}

async function grantArgs(input: GrantInput) {
  const { terms } = input;
  return {
    grantId: input.grantId,
    kind: GRANT_KIND_INDEX[terms.kind],
    actor: terms.actor as string as Address,
    caps: capsArgsOf(terms, input.tickBase),
    expiresAtSec: BigInt(terms.expiresAtSec),
    budget: terms.budgetBase,
    ...(input.previousGrantId === NO_GRANT ? {} : { previousGrant: await grantAddress(input.previousGrantId) }),
  };
}

export async function grantIx(owner: TransactionSigner, input: GrantInput): Promise<Instruction> {
  return getOwnerGrantInstructionAsync({ owner, ...(await grantArgs(input)), ...(await emit()) });
}

export async function depositAndGrantIx(owner: TransactionSigner, ownerAta: Address, collateralMint: Address, amount: bigint, input: GrantInput): Promise<Instruction> {
  return getOwnerDepositAndGrantInstructionAsync({ owner, ownerAta, collateralMint, amount, ...(await grantArgs(input)), ...(await emit()) });
}

export async function fundGrantIx(owner: TransactionSigner, grantId: bigint, amount: bigint): Promise<Instruction> {
  return getOwnerFundGrantInstructionAsync({ owner, grant: await grantAddress(grantId), amount, ...(await emit()) });
}

export async function withdrawIx(owner: TransactionSigner, ownerAta: Address, collateralMint: Address, amount: bigint, fromPrivate: boolean): Promise<Instruction> {
  const input = { owner, ownerAta, collateralMint, amount, ...(await emit()) };
  return fromPrivate ? getOwnerWithdrawPrivateInstructionAsync(input) : getOwnerWithdrawInstructionAsync(input);
}

export async function moveToPrivateIx(owner: TransactionSigner, amount: bigint): Promise<Instruction> {
  return getOwnerMoveToPrivateInstructionAsync({ owner, amount, ...(await emit()) });
}

export async function revokeIx(owner: TransactionSigner, grantId: bigint): Promise<Instruction> {
  return getOwnerRevokeInstructionAsync({ owner, grant: await grantAddress(grantId), ...(await emit()) });
}

/** An IOC through the vault's PROGRAM seat, in the engine's YES-terms price (vault.md §3.4). */
export interface PlaceOrder {
  outcome: 0 | 1;
  isBuy: boolean;
  priceTicks: number;
  lots: bigint;
  expireTs: number;
}

/** Attended (`owner_place`, the owner signs) or delegated (`actor_place_for`, the grant's actor signs for its owner). */
export type PlaceRoute = { kind: "vault"; owner: TransactionSigner } | { kind: "vault-grant"; actor: TransactionSigner; owner: Address; grantId: bigint };

export async function placeIx(route: PlaceRoute, engine: EngineBlock, order: PlaceOrder): Promise<Instruction> {
  if (!Number.isInteger(order.priceTicks) || order.priceTicks < 1 || order.priceTicks > 999) throw new Error(`price ${order.priceTicks} is not a tick in 1..999`);
  if (order.lots <= 0n) throw new Error(`lots ${order.lots} must be positive`);
  const common = { ...engine, ...order, expireTs: BigInt(order.expireTs), ...(await emit()) };
  if (route.kind === "vault") return getOwnerPlaceInstructionAsync({ owner: route.owner, ...common });
  return getActorPlaceForInstructionAsync({ actor: route.actor, owner: route.owner, grant: await grantAddress(route.grantId), grantId: route.grantId, ...common });
}

/**
 * `public_crank_settle` for one owner's slot: each attributed side's grant in its own slot, a grant shared by both sides
 * once as `yes_grant` (Anchor refuses a duplicate mutable account), and an attended side passes none.
 */
export async function crankIx(cranker: TransactionSigner, owner: Address, engine: Omit<EngineBlock, "book">, grants: { yes: bigint; no: bigint }): Promise<Instruction> {
  // The program reads `yes_grant` for the YES side's id and `no_grant` for a NO id that differs from it (vault.md §3.5).
  const yes = grants.yes;
  const no = grants.no !== grants.yes ? grants.no : NO_GRANT;
  return getPublicCrankSettleInstructionAsync({
    cranker,
    owner,
    series: engine.series,
    market: engine.market,
    ledger: engine.ledger,
    mvault: engine.mvault,
    collateralMint: engine.collateralMint,
    ...(yes === NO_GRANT ? {} : { yesGrant: await grantAddress(yes) }),
    ...(no === NO_GRANT ? {} : { noGrant: await grantAddress(no) }),
    ...(await emit()),
  });
}

/** Whole ticks of a YES-terms raw price, or a refusal when the price is not on the grid. */
export function ticksOf(priceRaw: bigint, tickBase: bigint): number {
  if (tickBase <= 0n || priceRaw % tickBase !== 0n) throw new Error(`price ${priceRaw} is not a whole number of ${tickBase}-unit ticks`);
  const ticks = priceRaw / tickBase;
  if (ticks < 1n || ticks > 999n) throw new Error(`price ${ticks} ticks is outside 1..999`);
  return Number(ticks);
}

/** Whole lots of an outcome amount, or a refusal when the size is not on the grid. */
export function lotsOf(contractsRaw: bigint, lotBase: bigint): bigint {
  if (lotBase <= 0n || contractsRaw % lotBase !== 0n) throw new Error(`size ${contractsRaw} is not a whole number of ${lotBase}-unit lots`);
  return contractsRaw / lotBase;
}
