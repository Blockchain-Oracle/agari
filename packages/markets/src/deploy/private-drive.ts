/**
 * The S10d drive's owner side and its books. The desk side of the drive is not here on purpose: the script calls the
 * real desk service (`openPrivateBet`, `cashOutPrivateBet` in `@agari/markets/private`), so what is proven on devnet
 * is the code the web runs, not a copy of it.
 */
import { fetchMaybeBudget, fetchMaybeDesk, findBudgetPda, findCustodyPda, findDeskAccountPda, getDeskChargeToPoolInstructionAsync, getOwnerDepositAndAllowInstructionAsync, getOwnerRevokeInstructionAsync, getOwnerWithdrawInstructionAsync } from "@agari/clients/agari-private";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getBase64Encoder, type Address } from "@solana/kit";
import { send, type SendContext } from "./send";

async function tokenBalance(ctx: SendContext, account: Address): Promise<bigint> {
  const info = await ctx.client.rpc.getAccountInfo(account, { encoding: "base64" }).send();
  if (!info.value) return 0n;
  const bytes = getBase64Encoder().encode(info.value.data[0]);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(64, true);
}

/** The Desk account with custody's balance beside it, and the identity the whole desk rests on. */
export async function readPrivateDesk(ctx: SendContext) {
  const [desk] = await findDeskAccountPda();
  const [custody] = await findCustodyPda();
  const account = await fetchMaybeDesk(ctx.client.rpc, desk);
  if (!account.exists) throw new Error(`desk ${desk} is not initialised: run scripts/deploy/init-private.ts`);
  const custodyBase = await tokenBalance(ctx, custody);
  const { owedBase, poolBase, inSlotsBase } = account.data;
  return { desk, custody, data: account.data, custodyBase, booksBase: owedBase + poolBase + inSlotsBase, balanced: custodyBase === owedBase + poolBase + inSlotsBase };
}

export async function readPrivateBudget(ctx: SendContext, owner: Address) {
  const [budget] = await findBudgetPda({ owner });
  const account = await fetchMaybeBudget(ctx.client.rpc, budget);
  return account.exists ? { balanceBase: account.data.balanceBase, allowanceBase: account.data.allowanceBase } : { balanceBase: 0n, allowanceBase: 0n };
}

async function ownerFunds(ctx: SendContext) {
  const d = await readPrivateDesk(ctx);
  const [ownerToken] = await findAssociatedTokenPda({ owner: ctx.client.payer.address, mint: d.data.collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return { accounts: { owner: ctx.client.payer, ownerToken, collateralMint: d.data.collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS }, ownerToken };
}

/** The owner's own top-up and allowance, signed by the client's payer. */
export async function depositAndAllowPrivate(ctx: SendContext, amountBase: bigint, allowanceBase: bigint) {
  const { accounts } = await ownerFunds(ctx);
  const ix = await getOwnerDepositAndAllowInstructionAsync({ ...accounts, amountBase, allowanceBase });
  const signature = await send(ctx, "deposit+allow", [ix], `${amountBase} in, the desk may spend ${allowanceBase}`);
  return { signature, budget: await readPrivateBudget(ctx, ctx.client.payer.address) };
}

export async function revokePrivate(ctx: SendContext) {
  const signature = await send(ctx, "revoke", [await getOwnerRevokeInstructionAsync({ owner: ctx.client.payer })], "the desk may spend nothing");
  return { signature, budget: await readPrivateBudget(ctx, ctx.client.payer.address) };
}

/** Pays the signer and nobody else, and needs nothing from the desk. */
export async function withdrawPrivate(ctx: SendContext, amountBase: bigint) {
  const { accounts, ownerToken } = await ownerFunds(ctx);
  const before = await tokenBalance(ctx, ownerToken);
  const signature = await send(ctx, "withdraw", [await getOwnerWithdrawInstructionAsync({ ...accounts, amountBase })], `${amountBase} back to the owner`);
  return { signature, receivedBase: (await tokenBalance(ctx, ownerToken)) - before, budget: await readPrivateBudget(ctx, ctx.client.payer.address) };
}

/**
 * A bare `desk_charge_to_pool` from the client's payer, with none of the desk service's own checks in front of it.
 * It exists to put the CHAIN's answer on record: what a desk key, or somebody holding one, can take from an owner
 * is what the owner allowed and not a unit more, and a key that is not the desk's can take nothing.
 */
export async function rawChargeAsPayer(ctx: SendContext, owner: Address, amountBase: bigint) {
  const chargeKey = crypto.getRandomValues(new Uint8Array(32));
  const ix = await getDeskChargeToPoolInstructionAsync({ desk: ctx.client.payer, owner, amountBase, chargeKey });
  return send(ctx, "raw charge", [ix], `${amountBase} from ${owner}, signed by ${ctx.client.payer.address}`);
}
