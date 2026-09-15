/**
 * What each vault TxIntent sends (tap-trading.md §1.2), planned from head-fresh reads with the program's own checks
 * mirrored first, so a refusal the program would revert with is answered before anything is journaled or signed.
 * Deposits and grants are never sponsored; withdraw, revoke and crank are, when no ATA has to be created.
 */
import { getVaultConfigDecoder } from "@agari/clients/agari-vault";
import type { VaultIntent } from "@agari/core/ports";
import { diagnosis, type Diagnosis, type MarketId } from "@agari/core/types";
import { GRANT_KIND_INDEX, type VaultDeployment } from "@agari/core/vault";
import { getTransferSolInstruction } from "@solana-program/system";
import { getCreateAssociatedTokenIdempotentInstructionAsync } from "@solana-program/token";
import type { Address, Instruction } from "@solana/kit";
import { loadAccount } from "../runtime/account-loader";
import { readMarket, readTokenBalance, readVenueStatic } from "../runtime/accounts";
import { MARKET_STATE } from "../runtime/mappers";
import type { WriteContext } from "../submitter/settle-write";
import { NO_GRANT, readGrantAccount, readVaultAccount, sideOf, slotOf, tickBaseOf } from "./accounts";
import { crankIx, depositAndGrantIx, depositIx, fundGrantIx, grantIx, moveToPrivateIx, openAccountIx, revokeIx, withdrawIx } from "./instructions";

export interface VaultPlan {
  instructions: Instruction[];
  sponsorable: boolean;
  /** SOL the signer spends beyond the fee (the key's top-up). */
  extraLamports: bigint;
  marketId?: MarketId;
  /** Whose `VaultAccount` the write changes. */
  owner: Address;
}

export class VaultRefusal extends Error {
  constructor(readonly diagnosis: Diagnosis) {
    super(diagnosis.technical);
    this.name = "VaultRefusal";
  }
}

const refuse = (kind: Diagnosis["kind"], technical: string, errorName?: string): never => {
  throw new VaultRefusal(diagnosis(kind, technical, errorName ? { errorName } : {}));
};
const positive = (amount: bigint, what: string) => amount > 0n || refuse("below-min-quantity", `${what} must be more than zero`, "ZeroAmount");
const covers = (have: bigint, need: bigint, what: string) => have >= need || refuse("insufficient-collateral", `${what} holds ${have} but ${need} is needed`, "Insufficient");
const kit = (value: string) => value as Address;

async function nextGrantId(deployment: VaultDeployment): Promise<bigint> {
  const { bytes } = await loadAccount(kit(deployment.config));
  if (!bytes) throw new Error(`VaultConfig ${deployment.config} is gone`);
  return getVaultConfigDecoder().decode(bytes).nextGrantId;
}

type GrantIntent = Extract<VaultIntent, { kind: "vault-grant" | "vault-deposit-and-grant" }>;

async function planGrant(ctx: WriteContext, deployment: VaultDeployment, intent: GrantIntent, nowSec: number): Promise<VaultPlan> {
  const owner = ctx.signer;
  const mint = kit(deployment.collateral);
  const { terms } = intent;
  const [account, venue, grantId, token] = await Promise.all([readVaultAccount(ctx.wallet), readVenueStatic(), nextGrantId(deployment), readTokenBalance(ctx.wallet, mint)]);
  const deposit = intent.kind === "vault-deposit-and-grant" ? intent.amountBase : 0n;
  if (intent.kind === "vault-deposit-and-grant") {
    positive(deposit, "the deposit");
    covers(token.amountBase ?? 0n, deposit, "the wallet");
  }
  if (terms.expiresAtSec <= nowSec) refuse("grant-refused", `the grant would expire at ${terms.expiresAtSec}, not after now (${nowSec})`, "BadExpiry");
  covers((account?.available ?? 0n) + deposit, terms.budgetBase, "the Trading Balance");
  const input = { grantId, terms, tickBase: tickBaseOf(venue.decimals), previousGrantId: account?.activeGrants[GRANT_KIND_INDEX[terms.kind]] ?? NO_GRANT };
  const instructions: Instruction[] = [];
  if (!account) instructions.push(await openAccountIx(owner, mint));
  const topUp = intent.kind === "vault-deposit-and-grant" ? (intent.keyTopUpLamports ?? 0n) : 0n;
  if (topUp > 0n) instructions.push(getTransferSolInstruction({ source: owner, destination: kit(terms.actor), amount: topUp }));
  instructions.push(intent.kind === "vault-deposit-and-grant" ? await depositAndGrantIx(owner, token.ata, mint, deposit, input) : await grantIx(owner, input));
  return { instructions, sponsorable: false, extraLamports: topUp, owner: owner.address };
}

async function planWithdraw(ctx: WriteContext, deployment: VaultDeployment, amount: bigint, fromPrivate: boolean): Promise<VaultPlan> {
  const mint = kit(deployment.collateral);
  positive(amount, "the withdrawal");
  const [account, token] = await Promise.all([readVaultAccount(ctx.wallet), readTokenBalance(ctx.wallet, mint)]);
  covers((fromPrivate ? account?.privateAvailable : account?.available) ?? 0n, amount, fromPrivate ? "the private balance" : "the Trading Balance");
  const instructions: Instruction[] = [];
  const createAta = token.amountBase === null;
  if (createAta) instructions.push(await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: ctx.signer, owner: ctx.signer.address, mint }));
  instructions.push(await withdrawIx(ctx.signer, token.ata, mint, amount, fromPrivate));
  return { instructions, sponsorable: !createAta, extraLamports: 0n, owner: ctx.signer.address };
}

async function planOwned(ctx: WriteContext, deployment: VaultDeployment, intent: Extract<VaultIntent, { kind: "vault-deposit" | "vault-move-private" | "vault-fund-grant" | "vault-revoke" }>, nowSec: number): Promise<VaultPlan> {
  const owner = ctx.signer;
  const mint = kit(deployment.collateral);
  const account = await readVaultAccount(ctx.wallet);
  const base = { sponsorable: false, extraLamports: 0n, owner: owner.address };
  switch (intent.kind) {
    case "vault-deposit": {
      positive(intent.amountBase, "the deposit");
      const token = await readTokenBalance(ctx.wallet, mint);
      covers(token.amountBase ?? 0n, intent.amountBase, "the wallet");
      const open = account ? [] : [await openAccountIx(owner, mint)];
      return { ...base, instructions: [...open, await depositIx(owner, token.ata, mint, intent.amountBase)] };
    }
    case "vault-move-private":
      positive(intent.amountBase, "the amount");
      covers(account?.available ?? 0n, intent.amountBase, "the Trading Balance");
      return { ...base, instructions: [await moveToPrivateIx(owner, intent.amountBase)] };
    case "vault-fund-grant":
    case "vault-revoke": {
      const grant = await readGrantAccount(intent.grantId);
      if (!grant) return refuse("grant-refused", `no grant #${intent.grantId}`, "NoSuchGrant");
      if (grant.owner !== (ctx.wallet as string)) refuse("grant-refused", `grant #${intent.grantId} belongs to ${grant.owner}`, "NotGrantOwner");
      if (intent.kind === "vault-revoke") return { ...base, sponsorable: true, instructions: [await revokeIx(owner, intent.grantId)] };
      if (grant.revoked !== 0) refuse("grant-refused", `grant #${intent.grantId} is revoked`, "GrantIsRevoked");
      if (nowSec > Number(grant.expiresAtSec)) refuse("grant-refused", `grant #${intent.grantId} expired at ${grant.expiresAtSec}`, "GrantExpired");
      positive(intent.amountBase, "the amount");
      covers(account?.available ?? 0n, intent.amountBase, "the Trading Balance");
      return { ...base, instructions: [await fundGrantIx(owner, intent.grantId, intent.amountBase)] };
    }
  }
}

/** Anyone may crank; the payout always lands on the slot's owner (vault.md §3.5). */
async function planCrank(ctx: WriteContext, deployment: VaultDeployment, owner: Address, marketId: MarketId): Promise<VaultPlan> {
  const [account, market] = await Promise.all([readVaultAccount(owner), readMarket(marketId)]);
  const slot = slotOf(account, marketId);
  if (!slot) return refuse("already-claimed", `${owner} holds nothing through the vault on Window ${marketId}`, "NothingToSettle");
  if (!market) return refuse("already-claimed", `Window ${marketId} is closed`, "NothingToSettle");
  if (market.data.state === MARKET_STATE.open) refuse("not-settled", `Window ${marketId} has not settled yet`, "MarketNotSettled");
  const { data } = market;
  const engine = { series: data.series, market: market.address, ledger: data.ledger, mvault: data.mvault, collateralMint: kit(deployment.collateral) };
  const ix = await crankIx(ctx.signer, owner, engine, { yes: sideOf(slot, 0).grantId, no: sideOf(slot, 1).grantId });
  return { instructions: [ix], sponsorable: true, extraLamports: 0n, marketId, owner };
}

/** The plan for one vault intent, or a `VaultRefusal` thrown with the program's own words. */
export async function planVaultIntent(ctx: WriteContext, deployment: VaultDeployment, intent: VaultIntent, nowSec: number): Promise<VaultPlan> {
  switch (intent.kind) {
    case "vault-grant":
    case "vault-deposit-and-grant":
      return planGrant(ctx, deployment, intent, nowSec);
    case "vault-withdraw":
    case "vault-withdraw-private":
      return planWithdraw(ctx, deployment, intent.amountBase, intent.kind === "vault-withdraw-private");
    case "vault-crank-settle":
      return planCrank(ctx, deployment, kit(intent.owner), intent.marketId);
    case "vault-sweep":
      return refuse("contract-revert", "nothing to sweep: proceeds are withdrawn on every fill");
    default:
      return planOwned(ctx, deployment, intent, nowSec);
  }
}
